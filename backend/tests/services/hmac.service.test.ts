import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRedis, MockRedis } from '../helpers/mock-redis.js';

// Mock env before importing the service
vi.mock('../../src/config/env.js', () => ({
  env: {
    HMAC_CLIENT_KEY: 'test_hmac_key_that_is_at_least_32_characters_long',
  },
}));

import { verifyHmac, computeSignature, HmacParams } from '../../src/services/hmac.service.js';
import { sha256 } from '../../src/utils/crypto.js';

describe('HMAC service', () => {
  let redis: MockRedis;

  beforeEach(() => {
    redis = createMockRedis();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeValidParams(overrides: Partial<HmacParams> = {}): HmacParams {
    const now = Math.floor(Date.now() / 1000).toString();
    const method = 'POST';
    const path = '/v1/auth/preflight';
    const body = '{"test":true}';
    const bodyHash = sha256(body);
    const signature = computeSignature(method, path, now, bodyHash);

    return {
      method,
      path,
      timestamp: now,
      nonce: 'unique-nonce-123',
      body,
      signature,
      ...overrides,
    };
  }

  describe('computeSignature', () => {
    it('produces deterministic signatures', () => {
      const sig1 = computeSignature('POST', '/v1/test', '1000000', 'abc123');
      const sig2 = computeSignature('POST', '/v1/test', '1000000', 'abc123');
      expect(sig1).toBe(sig2);
    });

    it('changes with different method', () => {
      const sig1 = computeSignature('POST', '/v1/test', '1000000', 'abc');
      const sig2 = computeSignature('GET', '/v1/test', '1000000', 'abc');
      expect(sig1).not.toBe(sig2);
    });

    it('changes with different path', () => {
      const sig1 = computeSignature('POST', '/v1/a', '1000000', 'abc');
      const sig2 = computeSignature('POST', '/v1/b', '1000000', 'abc');
      expect(sig1).not.toBe(sig2);
    });

    it('changes with different timestamp', () => {
      const sig1 = computeSignature('POST', '/v1/a', '1000000', 'abc');
      const sig2 = computeSignature('POST', '/v1/a', '1000001', 'abc');
      expect(sig1).not.toBe(sig2);
    });

    it('changes with different body hash', () => {
      const sig1 = computeSignature('POST', '/v1/a', '1000000', 'hash1');
      const sig2 = computeSignature('POST', '/v1/a', '1000000', 'hash2');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verifyHmac', () => {
    it('accepts valid signature', async () => {
      const params = makeValidParams();
      await expect(verifyHmac(redis as any, params)).resolves.toBeUndefined();
    });

    it('rejects timestamp too far in the past (>30s)', async () => {
      const params = makeValidParams({
        timestamp: (Math.floor(Date.now() / 1000) - 60).toString(),
      });
      // Recompute signature with the old timestamp
      const bodyHash = sha256(params.body);
      params.signature = computeSignature(params.method, params.path, params.timestamp, bodyHash);

      await expect(verifyHmac(redis as any, params)).rejects.toThrow();
    });

    it('rejects timestamp too far in the future (>30s)', async () => {
      const ts = (Math.floor(Date.now() / 1000) + 60).toString();
      const params = makeValidParams({ timestamp: ts });
      const bodyHash = sha256(params.body);
      params.signature = computeSignature(params.method, params.path, ts, bodyHash);

      await expect(verifyHmac(redis as any, params)).rejects.toThrow();
    });

    it('accepts timestamp within ±30s drift', async () => {
      const ts = (Math.floor(Date.now() / 1000) - 15).toString();
      const params = makeValidParams({ timestamp: ts });
      const bodyHash = sha256(params.body);
      params.signature = computeSignature(params.method, params.path, ts, bodyHash);

      await expect(verifyHmac(redis as any, params)).resolves.toBeUndefined();
    });

    it('rejects non-numeric timestamp', async () => {
      const params = makeValidParams({ timestamp: 'not-a-number' });
      await expect(verifyHmac(redis as any, params)).rejects.toThrow();
    });

    it('rejects reused nonce', async () => {
      const params = makeValidParams();
      // First call succeeds
      await verifyHmac(redis as any, params);

      // Second call with same nonce — redis.set returns null (already exists)
      redis.set.mockResolvedValueOnce(null);
      const params2 = makeValidParams({ nonce: params.nonce });
      await expect(verifyHmac(redis as any, params2)).rejects.toThrow();
    });

    it('rejects tampered signature', async () => {
      const params = makeValidParams({ signature: 'tampered_signature_value' });
      await expect(verifyHmac(redis as any, params)).rejects.toThrow();
    });

    it('rejects tampered body', async () => {
      const params = makeValidParams();
      params.body = '{"tampered":true}'; // body changed but signature stays
      await expect(verifyHmac(redis as any, params)).rejects.toThrow();
    });

    it('handles empty body', async () => {
      const now = Math.floor(Date.now() / 1000).toString();
      const bodyHash = sha256('');
      const sig = computeSignature('GET', '/v1/test', now, bodyHash);
      const params: HmacParams = {
        method: 'GET',
        path: '/v1/test',
        timestamp: now,
        nonce: 'nonce-empty-body',
        body: '',
        signature: sig,
      };

      await expect(verifyHmac(redis as any, params)).resolves.toBeUndefined();
    });

    it('stores nonce with correct TTL in Redis', async () => {
      const params = makeValidParams();
      await verifyHmac(redis as any, params);

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('hmac:nonce:'),
        '1',
        'EX',
        60,
        'NX',
      );
    });
  });
});
