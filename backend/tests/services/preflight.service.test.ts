import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRedis, MockRedis } from '../helpers/mock-redis.js';

vi.mock('../../src/config/env.js', () => ({
  env: {
    PREFLIGHT_SECRET: 'test_preflight_secret_that_is_at_least_32_chars_long',
    PREFLIGHT_TTL_SECONDS: 120,
  },
}));

import { issuePreflight, consumePreflight, storePreflight } from '../../src/services/preflight.service.js';
import { sha256 } from '../../src/utils/crypto.js';

describe('preflight service', () => {
  let redis: MockRedis;

  beforeEach(() => {
    redis = createMockRedis();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('issuePreflight', () => {
    it('returns a token and payload', () => {
      const { token, payload } = issuePreflight({
        deviceId: 'dev-1',
        ip: '192.168.1.1',
        channel: 'web',
        riskScore: 15,
      });

      expect(token).toBeTruthy();
      expect(typeof token).toBe('string');
      expect(payload.device_id).toBe('dev-1');
      expect(payload.channel).toBe('web');
      expect(payload.risk_score).toBe(15);
      expect(payload.jti).toBeTruthy();
      expect(payload.session_id).toBeTruthy();
    });

    it('hashes the IP in payload', () => {
      const { payload } = issuePreflight({
        deviceId: 'dev-1',
        ip: '192.168.1.1',
        channel: 'web',
        riskScore: 0,
      });

      expect(payload.ip_hash).toBe(sha256('192.168.1.1'));
      expect(payload.ip_hash).not.toBe('192.168.1.1');
    });

    it('sets correct expiry', () => {
      const { payload } = issuePreflight({
        deviceId: 'dev-1',
        ip: '10.0.0.1',
        channel: 'mobile',
        riskScore: 5,
      });

      const now = Math.floor(Date.now() / 1000);
      expect(payload.exp).toBe(now + 120);
      expect(payload.iat).toBe(now);
    });

    it('generates unique JTIs', () => {
      const p1 = issuePreflight({ deviceId: 'dev-1', ip: '1.2.3.4', channel: 'web', riskScore: 0 });
      const p2 = issuePreflight({ deviceId: 'dev-1', ip: '1.2.3.4', channel: 'web', riskScore: 0 });
      expect(p1.payload.jti).not.toBe(p2.payload.jti);
    });
  });

  describe('consumePreflight', () => {
    it('accepts valid token with matching IP and device', async () => {
      const { token } = issuePreflight({
        deviceId: 'dev-1',
        ip: '192.168.1.1',
        channel: 'web',
        riskScore: 10,
      });

      const payload = await consumePreflight(redis as any, token, '192.168.1.1', 'dev-1');
      expect(payload.device_id).toBe('dev-1');
      expect(payload.channel).toBe('web');
    });

    it('rejects token with IP mismatch', async () => {
      const { token } = issuePreflight({
        deviceId: 'dev-1',
        ip: '192.168.1.1',
        channel: 'web',
        riskScore: 0,
      });

      await expect(
        consumePreflight(redis as any, token, '10.0.0.1', 'dev-1'),
      ).rejects.toThrow('IP mismatch');
    });

    it('rejects token with device mismatch', async () => {
      const { token } = issuePreflight({
        deviceId: 'dev-1',
        ip: '192.168.1.1',
        channel: 'web',
        riskScore: 0,
      });

      await expect(
        consumePreflight(redis as any, token, '192.168.1.1', 'dev-2'),
      ).rejects.toThrow('Device mismatch');
    });

    it('rejects already-used token (replay attack)', async () => {
      const { token } = issuePreflight({
        deviceId: 'dev-1',
        ip: '192.168.1.1',
        channel: 'web',
        riskScore: 0,
      });

      // First consume succeeds
      await consumePreflight(redis as any, token, '192.168.1.1', 'dev-1');

      // Second attempt — nonce already in Redis, set returns null
      redis.set.mockResolvedValueOnce(null);

      await expect(
        consumePreflight(redis as any, token, '192.168.1.1', 'dev-1'),
      ).rejects.toThrow('Preflight token already used');
    });

    it('rejects expired token', async () => {
      const { token } = issuePreflight({
        deviceId: 'dev-1',
        ip: '192.168.1.1',
        channel: 'web',
        riskScore: 0,
      });

      // Advance time past TTL
      vi.advanceTimersByTime(130_000); // 130 seconds > 120s TTL

      await expect(
        consumePreflight(redis as any, token, '192.168.1.1', 'dev-1'),
      ).rejects.toThrow();
    });

    it('rejects tampered token', async () => {
      await expect(
        consumePreflight(redis as any, 'totally.invalid.token', '192.168.1.1', 'dev-1'),
      ).rejects.toThrow();
    });
  });

  describe('storePreflight', () => {
    it('stores JTI in Redis with TTL', async () => {
      await storePreflight(redis as any, 'test-jti-123');

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('preflight:jti:issued:test-jti-123'),
        '1',
        'EX',
        120,
      );
    });
  });
});
