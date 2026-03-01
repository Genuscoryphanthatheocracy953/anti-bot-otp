import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockRedis, MockRedis } from '../helpers/mock-redis.js';
import { createMockPool, MockPool } from '../helpers/mock-pg.js';

vi.mock('../../src/config/env.js', () => ({
  env: {
    OTP_TTL_SECONDS: 180,
    OTP_LENGTH: 6,
    OTP_MAX_VERIFY_ATTEMPTS: 5,
    OTP_RESEND_COOLDOWN_SECONDS: 60,
  },
}));

import { createAndStoreOtp, verifyOtp } from '../../src/services/otp.service.js';

describe('OTP service', () => {
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

  const baseParams = {
    phone: '+962792084410',
    purpose: 'login',
    deviceId: 'device-123',
    channel: 'web' as const,
    ip: '192.168.1.1',
    riskScore: 10,
  };

  describe('createAndStoreOtp', () => {
    it('generates OTP with correct length and returns challenge info', async () => {
      const result = await createAndStoreOtp(redis as any, pool as any, baseParams);

      expect(result.otp).toHaveLength(6);
      expect(result.otp).toMatch(/^\d{6}$/);
      expect(result.challengeId).toBeTruthy();
      expect(result.expiresAt).toBeGreaterThan(0);
    });

    it('stores OTP record in Redis with TTL', async () => {
      await createAndStoreOtp(redis as any, pool as any, baseParams);

      // Should store OTP record
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('otp:+962792084410:login'),
        expect.any(String),
        'EX',
        180,
      );
    });

    it('sets resend cooldown in Redis', async () => {
      await createAndStoreOtp(redis as any, pool as any, baseParams);

      // Cooldown key should be set
      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('otp:cooldown:+962792084410:login'),
        '1',
        'EX',
        60,
      );
    });

    it('stores audit record in PostgreSQL', async () => {
      await createAndStoreOtp(redis as any, pool as any, baseParams);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO otp_requests'),
        expect.arrayContaining(['+962792084410', 'login']),
      );
    });

    it('rejects when cooldown is active', async () => {
      // Simulate active cooldown
      redis.ttl.mockResolvedValueOnce(45); // 45 seconds remaining

      await expect(
        createAndStoreOtp(redis as any, pool as any, baseParams),
      ).rejects.toThrow('Please wait');
    });

    it('includes argon2 hash in stored record', async () => {
      await createAndStoreOtp(redis as any, pool as any, baseParams);

      // Get the stored JSON from redis.set calls
      const otpSetCall = redis.set.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('otp:+962') && !call[0].includes('cooldown'),
      );
      expect(otpSetCall).toBeTruthy();

      const stored = JSON.parse(otpSetCall![1] as string);
      expect(stored.hash).toMatch(/^\$argon2/);
      expect(stored.challenge_id).toBeTruthy();
      expect(stored.device_id).toBe('device-123');
      expect(stored.attempts).toBe(0);
      expect(stored.max_attempts).toBe(5);
    });

    it('generates unique challenge IDs', async () => {
      const r1 = await createAndStoreOtp(redis as any, pool as any, baseParams);
      redis._reset();
      const r2 = await createAndStoreOtp(redis as any, pool as any, baseParams);

      expect(r1.challengeId).not.toBe(r2.challengeId);
    });
  });

  describe('verifyOtp', () => {
    async function setupOtp() {
      const result = await createAndStoreOtp(redis as any, pool as any, baseParams);
      return result;
    }

    it('verifies correct OTP code', async () => {
      const { otp, challengeId } = await setupOtp();

      // Mock redis.get to return the stored record
      const otpSetCall = redis.set.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('otp:+962') && !call[0].includes('cooldown'),
      );
      redis.get.mockResolvedValueOnce(otpSetCall![1] as string);
      redis.ttl.mockResolvedValueOnce(170);

      const { verified } = await verifyOtp(redis as any, pool as any, {
        phone: '+962792084410',
        code: otp,
        challengeId,
        deviceId: 'device-123',
        purpose: 'login',
      });

      expect(verified).toBe(true);
    });

    it('rejects wrong OTP code', async () => {
      const { challengeId } = await setupOtp();

      const otpSetCall = redis.set.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('otp:+962') && !call[0].includes('cooldown'),
      );
      redis.get.mockResolvedValueOnce(otpSetCall![1] as string);
      redis.ttl.mockResolvedValueOnce(170);

      const { verified } = await verifyOtp(redis as any, pool as any, {
        phone: '+962792084410',
        code: '000000',
        challengeId,
        deviceId: 'device-123',
        purpose: 'login',
      });

      expect(verified).toBe(false);
    });

    it('throws when OTP expired (not in Redis)', async () => {
      redis.get.mockResolvedValueOnce(null);

      await expect(
        verifyOtp(redis as any, pool as any, {
          phone: '+962792084410',
          code: '123456',
          challengeId: 'fake-id',
          deviceId: 'device-123',
          purpose: 'login',
        }),
      ).rejects.toThrow('OTP has expired');
    });

    it('throws on challenge ID mismatch', async () => {
      const { challengeId: _cid } = await setupOtp();

      const otpSetCall = redis.set.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('otp:+962') && !call[0].includes('cooldown'),
      );
      redis.get.mockResolvedValueOnce(otpSetCall![1] as string);

      await expect(
        verifyOtp(redis as any, pool as any, {
          phone: '+962792084410',
          code: '123456',
          challengeId: 'wrong-challenge-id',
          deviceId: 'device-123',
          purpose: 'login',
        }),
      ).rejects.toThrow('Challenge ID mismatch');
    });

    it('throws on device ID mismatch', async () => {
      const { challengeId } = await setupOtp();

      const otpSetCall = redis.set.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('otp:+962') && !call[0].includes('cooldown'),
      );
      redis.get.mockResolvedValueOnce(otpSetCall![1] as string);

      await expect(
        verifyOtp(redis as any, pool as any, {
          phone: '+962792084410',
          code: '123456',
          challengeId,
          deviceId: 'different-device',
          purpose: 'login',
        }),
      ).rejects.toThrow('Device ID mismatch');
    });

    it('throws when max attempts exceeded', async () => {
      const { challengeId } = await setupOtp();

      const otpSetCall = redis.set.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('otp:+962') && !call[0].includes('cooldown'),
      );
      const record = JSON.parse(otpSetCall![1] as string);
      record.attempts = 5; // Already at max
      redis.get.mockResolvedValueOnce(JSON.stringify(record));

      await expect(
        verifyOtp(redis as any, pool as any, {
          phone: '+962792084410',
          code: '123456',
          challengeId,
          deviceId: 'device-123',
          purpose: 'login',
        }),
      ).rejects.toThrow('Maximum verification attempts exceeded');
    });

    it('increments attempt count on failed verification', async () => {
      const { challengeId } = await setupOtp();

      const otpSetCall = redis.set.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('otp:+962') && !call[0].includes('cooldown'),
      );
      redis.get.mockResolvedValueOnce(otpSetCall![1] as string);
      redis.ttl.mockResolvedValueOnce(170);

      await verifyOtp(redis as any, pool as any, {
        phone: '+962792084410',
        code: '000000', // wrong
        challengeId,
        deviceId: 'device-123',
        purpose: 'login',
      });

      // Should update attempts in PostgreSQL
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE otp_requests SET attempts'),
        expect.arrayContaining([challengeId, 1]),
      );
    });

    it('deletes OTP from Redis after successful verification', async () => {
      const { otp, challengeId } = await setupOtp();

      const otpSetCall = redis.set.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('otp:+962') && !call[0].includes('cooldown'),
      );
      redis.get.mockResolvedValueOnce(otpSetCall![1] as string);
      redis.ttl.mockResolvedValueOnce(170);

      await verifyOtp(redis as any, pool as any, {
        phone: '+962792084410',
        code: otp,
        challengeId,
        deviceId: 'device-123',
        purpose: 'login',
      });

      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining('otp:+962792084410:login'),
      );
    });

    it('throws when TTL is 0 or negative', async () => {
      const { challengeId } = await setupOtp();

      const otpSetCall = redis.set.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes('otp:+962') && !call[0].includes('cooldown'),
      );
      redis.get.mockResolvedValueOnce(otpSetCall![1] as string);
      redis.ttl.mockResolvedValueOnce(0); // Expired

      await expect(
        verifyOtp(redis as any, pool as any, {
          phone: '+962792084410',
          code: '123456',
          challengeId,
          deviceId: 'device-123',
          purpose: 'login',
        }),
      ).rejects.toThrow('OTP has expired');
    });
  });
});
