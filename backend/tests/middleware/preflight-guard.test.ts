import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRedis, MockRedis } from '../helpers/mock-redis.js';

vi.mock('../../src/config/env.js', () => ({
  env: {
    PREFLIGHT_SECRET: 'test_preflight_secret_that_is_at_least_32_chars_long',
    PREFLIGHT_TTL_SECONDS: 120,
  },
}));

import { createPreflightGuard } from '../../src/middleware/preflight-guard.js';
import { issuePreflight } from '../../src/services/preflight.service.js';

describe('preflight guard middleware', () => {
  let redis: MockRedis;

  beforeEach(() => {
    redis = createMockRedis();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeRequest(token?: string) {
    return {
      headers: {
        'x-preflight-token': token,
      },
      ctx: {
        ip: '192.168.1.1',
        deviceId: 'device-1',
      },
    } as any;
  }

  it('passes with valid preflight token', async () => {
    const { token } = issuePreflight({
      deviceId: 'device-1',
      ip: '192.168.1.1',
      channel: 'web',
      riskScore: 10,
    });

    const guard = createPreflightGuard(redis as any);
    const request = makeRequest(token);

    await expect(guard(request, {} as any)).resolves.toBeUndefined();
    expect(request.preflight).toBeTruthy();
    expect(request.preflight.device_id).toBe('device-1');
  });

  it('throws 401 when token is missing', async () => {
    const guard = createPreflightGuard(redis as any);
    const request = makeRequest(undefined);

    await expect(guard(request, {} as any)).rejects.toThrow('Missing or invalid preflight token');
  });

  it('throws 401 with invalid token', async () => {
    const guard = createPreflightGuard(redis as any);
    const request = makeRequest('invalid.token.here');

    await expect(guard(request, {} as any)).rejects.toThrow('Missing or invalid preflight token');
  });

  it('throws 401 when IP changed since preflight', async () => {
    const { token } = issuePreflight({
      deviceId: 'device-1',
      ip: '192.168.1.1',
      channel: 'web',
      riskScore: 0,
    });

    const guard = createPreflightGuard(redis as any);
    const request = {
      headers: { 'x-preflight-token': token },
      ctx: { ip: '10.0.0.1', deviceId: 'device-1' }, // Different IP
    } as any;

    await expect(guard(request, {} as any)).rejects.toThrow();
  });

  it('throws 401 when device changed since preflight', async () => {
    const { token } = issuePreflight({
      deviceId: 'device-1',
      ip: '192.168.1.1',
      channel: 'web',
      riskScore: 0,
    });

    const guard = createPreflightGuard(redis as any);
    const request = {
      headers: { 'x-preflight-token': token },
      ctx: { ip: '192.168.1.1', deviceId: 'device-2' }, // Different device
    } as any;

    await expect(guard(request, {} as any)).rejects.toThrow();
  });

  it('throws 401 on token replay (second use)', async () => {
    const { token } = issuePreflight({
      deviceId: 'device-1',
      ip: '192.168.1.1',
      channel: 'web',
      riskScore: 0,
    });

    const guard = createPreflightGuard(redis as any);

    // First use succeeds
    const req1 = makeRequest(token);
    await guard(req1, {} as any);

    // Second use — JTI already exists
    redis.set.mockResolvedValueOnce(null);
    const req2 = makeRequest(token);
    await expect(guard(req2, {} as any)).rejects.toThrow();
  });
});
