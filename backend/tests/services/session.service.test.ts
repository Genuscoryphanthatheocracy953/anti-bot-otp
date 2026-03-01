import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRedis, MockRedis } from '../helpers/mock-redis.js';
import { createMockPool, MockPool } from '../helpers/mock-pg.js';

vi.mock('../../src/config/env.js', () => ({
  env: {
    JWT_SECRET: 'test_jwt_secret_that_is_at_least_32_characters_long_for_tests',
    REFRESH_TOKEN_SECRET: 'test_refresh_secret_that_is_at_least_32_characters_long_yep',
  },
}));

import { createSession, verifyAccessToken, isSessionRevoked } from '../../src/services/session.service.js';

describe('session service', () => {
  let redis: MockRedis;
  let pool: MockPool;

  beforeEach(() => {
    redis = createMockRedis();
    pool = createMockPool();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createSession', () => {
    it('returns access and refresh tokens', async () => {
      const { accessToken, refreshToken } = await createSession(pool as any, {
        phone: '+962792084410',
        deviceId: 'device-1',
        channel: 'web',
        ip: '192.168.1.1',
      });

      expect(accessToken).toBeTruthy();
      expect(refreshToken).toBeTruthy();
      expect(accessToken).not.toBe(refreshToken);
    });

    it('stores session in PostgreSQL', async () => {
      await createSession(pool as any, {
        phone: '+962792084410',
        deviceId: 'device-1',
        channel: 'web',
        ip: '192.168.1.1',
      });

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO sessions'),
        expect.arrayContaining(['+962792084410', 'device-1']),
      );
    });

    it('access token is verifiable', async () => {
      const { accessToken } = await createSession(pool as any, {
        phone: '+962792084410',
        deviceId: 'device-1',
        channel: 'web',
        ip: '192.168.1.1',
      });

      const payload = verifyAccessToken(accessToken);
      expect(payload.sub).toBe('+962792084410');
      expect(payload.device_id).toBe('device-1');
      expect(payload.channel).toBe('web');
      expect(payload.jti).toBeTruthy();
    });
  });

  describe('verifyAccessToken', () => {
    it('verifies valid token and returns payload', async () => {
      const { accessToken } = await createSession(pool as any, {
        phone: '+12345678901',
        deviceId: 'dev-abc',
        channel: 'mobile',
        ip: '10.0.0.1',
      });

      const payload = verifyAccessToken(accessToken);
      expect(payload.sub).toBe('+12345678901');
      expect(payload.device_id).toBe('dev-abc');
    });

    it('throws on invalid token', () => {
      expect(() => verifyAccessToken('not.a.valid.jwt')).toThrow();
    });

    it('throws on expired token', async () => {
      const { accessToken } = await createSession(pool as any, {
        phone: '+12345678901',
        deviceId: 'dev-1',
        channel: 'web',
        ip: '10.0.0.1',
      });

      // Advance past 15-minute expiry
      vi.advanceTimersByTime(16 * 60 * 1000);

      expect(() => verifyAccessToken(accessToken)).toThrow();
    });

    it('throws on token signed with wrong secret', () => {
      const jwt = require('jsonwebtoken');
      const fakeToken = jwt.sign({ sub: 'test' }, 'wrong_secret_key');
      expect(() => verifyAccessToken(fakeToken)).toThrow();
    });
  });

  describe('isSessionRevoked', () => {
    it('returns false for non-revoked session', async () => {
      const revoked = await isSessionRevoked(redis as any, 'some-jti');
      expect(revoked).toBe(false);
    });

    it('returns true when session is revoked', async () => {
      redis.exists.mockResolvedValueOnce(1);

      const revoked = await isSessionRevoked(redis as any, 'revoked-jti');
      expect(revoked).toBe(true);
    });

    it('checks correct Redis key pattern', async () => {
      await isSessionRevoked(redis as any, 'test-jti-xyz');

      expect(redis.exists).toHaveBeenCalledWith(
        expect.stringContaining('session:revoked:test-jti-xyz'),
      );
    });
  });
});
