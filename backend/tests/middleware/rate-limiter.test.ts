import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRedis, MockRedis } from '../helpers/mock-redis.js';

vi.mock('../../src/config/env.js', () => ({
  env: {},
}));

import { createRateLimiter } from '../../src/middleware/rate-limiter.js';

describe('rate limiter middleware', () => {
  let redis: MockRedis;

  beforeEach(() => {
    redis = createMockRedis();
  });

  function makeRequest(overrides: Record<string, unknown> = {}) {
    return {
      ctx: {
        ip: '192.168.1.1',
        subnet: '192.168.1.0/24',
        deviceId: 'device-1',
        channel: 'web',
        fingerprint: 'fp-hash',
        ...overrides,
      },
      body: {
        phone: '+962792084410',
      },
    } as any;
  }

  function makeReply() {
    return {
      header: vi.fn(),
    } as any;
  }

  it('allows request when under limits', async () => {
    const limiter = createRateLimiter(redis as any, 'preflight');
    const request = makeRequest();
    const reply = makeReply();

    // Default mock returns [1, 0] = allowed
    await expect(limiter(request, reply)).resolves.toBeUndefined();
  });

  it('throws RateLimitError when over limits', async () => {
    // Return [0, 60] = blocked with 60s retry
    redis.eval.mockResolvedValue([0, 60]);

    const limiter = createRateLimiter(redis as any, 'preflight');
    const request = makeRequest();
    const reply = makeReply();

    await expect(limiter(request, reply)).rejects.toThrow('Too many requests');
  });

  it('sets Retry-After header on rate limit', async () => {
    redis.eval.mockResolvedValue([0, 120]);

    const limiter = createRateLimiter(redis as any, 'preflight');
    const request = makeRequest();
    const reply = makeReply();

    try {
      await limiter(request, reply);
    } catch {
      // Expected
    }

    expect(reply.header).toHaveBeenCalledWith('Retry-After', expect.any(String));
  });

  it('checks multiple dimensions for otp-send', async () => {
    const limiter = createRateLimiter(redis as any, 'otp-send');
    const request = makeRequest();
    const reply = makeReply();

    await limiter(request, reply);

    // Should have called eval for ip, subnet, device, phone, fingerprint
    expect(redis.eval.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('takes worst retryAfter across dimensions', async () => {
    // First dimension: allowed. Rest: blocked with different times.
    redis.eval
      .mockResolvedValueOnce([1, 0])     // ip: ok
      .mockResolvedValueOnce([0, 30])    // subnet: blocked 30s
      .mockResolvedValueOnce([0, 120])   // device: blocked 120s
      .mockResolvedValueOnce([0, 60])    // phone: blocked 60s
      .mockResolvedValueOnce([1, 0]);    // fingerprint: ok

    const limiter = createRateLimiter(redis as any, 'otp-send');
    const request = makeRequest();
    const reply = makeReply();

    try {
      await limiter(request, reply);
    } catch (err: any) {
      expect(err.retryAfter).toBe(120); // Worst case
    }
  });

  it('uses Lua sliding window script', async () => {
    const limiter = createRateLimiter(redis as any, 'preflight');
    const request = makeRequest();
    const reply = makeReply();

    await limiter(request, reply);

    // redis.eval should be called with Lua script
    expect(redis.eval).toHaveBeenCalled();
    const firstCall = redis.eval.mock.calls[0];
    expect(firstCall[0]).toContain('ZREMRANGEBYSCORE');
  });
});
