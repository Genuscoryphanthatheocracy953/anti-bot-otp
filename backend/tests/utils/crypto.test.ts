import { describe, it, expect } from 'vitest';
import {
  generateOtp,
  hashOtp,
  verifyOtpHash,
  sha256,
  hmacSha256,
  randomUUID,
  randomBytes,
} from '../../src/utils/crypto.js';

describe('crypto utilities', () => {
  describe('generateOtp', () => {
    it('generates OTP of correct length', () => {
      const otp = generateOtp(6);
      expect(otp).toHaveLength(6);
    });

    it('pads with leading zeros when needed', () => {
      // Generate many OTPs to statistically ensure padding works
      const otps = Array.from({ length: 100 }, () => generateOtp(6));
      for (const otp of otps) {
        expect(otp).toHaveLength(6);
        expect(otp).toMatch(/^\d{6}$/);
      }
    });

    it('generates different OTPs across calls', () => {
      const otps = new Set(Array.from({ length: 50 }, () => generateOtp(6)));
      // At least 2 unique values out of 50 tries
      expect(otps.size).toBeGreaterThan(1);
    });

    it('respects different lengths', () => {
      expect(generateOtp(4)).toHaveLength(4);
      expect(generateOtp(8)).toHaveLength(8);
    });

    it('only contains digits', () => {
      for (let i = 0; i < 20; i++) {
        expect(generateOtp(6)).toMatch(/^\d+$/);
      }
    });
  });

  describe('hashOtp / verifyOtpHash', () => {
    it('hashes and verifies correctly', async () => {
      const otp = '123456';
      const hash = await hashOtp(otp);
      expect(hash).toBeTruthy();
      expect(hash).not.toBe(otp);
      expect(hash.startsWith('$argon2')).toBe(true);

      const valid = await verifyOtpHash('123456', hash);
      expect(valid).toBe(true);
    });

    it('rejects wrong OTP', async () => {
      const hash = await hashOtp('123456');
      const valid = await verifyOtpHash('654321', hash);
      expect(valid).toBe(false);
    });

    it('produces different hashes for same input (salted)', async () => {
      const h1 = await hashOtp('123456');
      const h2 = await hashOtp('123456');
      expect(h1).not.toBe(h2);
    });
  });

  describe('sha256', () => {
    it('produces consistent hex hash', () => {
      const hash = sha256('hello');
      expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });

    it('produces different hash for different input', () => {
      expect(sha256('a')).not.toBe(sha256('b'));
    });

    it('handles empty string', () => {
      const hash = sha256('');
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('returns 64-char hex string', () => {
      expect(sha256('test')).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('hmacSha256', () => {
    it('produces consistent HMAC', () => {
      const sig1 = hmacSha256('key123', 'data');
      const sig2 = hmacSha256('key123', 'data');
      expect(sig1).toBe(sig2);
    });

    it('different keys produce different signatures', () => {
      const sig1 = hmacSha256('key1', 'data');
      const sig2 = hmacSha256('key2', 'data');
      expect(sig1).not.toBe(sig2);
    });

    it('different data produces different signatures', () => {
      const sig1 = hmacSha256('key', 'data1');
      const sig2 = hmacSha256('key', 'data2');
      expect(sig1).not.toBe(sig2);
    });

    it('returns 64-char hex string', () => {
      expect(hmacSha256('k', 'd')).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('randomUUID', () => {
    it('returns valid UUID v4 format', () => {
      const uuid = randomUUID();
      expect(uuid).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    });

    it('generates unique values', () => {
      const uuids = new Set(Array.from({ length: 20 }, () => randomUUID()));
      expect(uuids.size).toBe(20);
    });
  });

  describe('randomBytes', () => {
    it('returns hex string of correct length', () => {
      const bytes = randomBytes(16);
      expect(bytes).toHaveLength(32); // 16 bytes = 32 hex chars
    });

    it('generates unique values', () => {
      const b1 = randomBytes(16);
      const b2 = randomBytes(16);
      expect(b1).not.toBe(b2);
    });

    it('only contains hex characters', () => {
      expect(randomBytes(32)).toMatch(/^[a-f0-9]+$/);
    });
  });
});
