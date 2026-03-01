import { describe, it, expect } from 'vitest';
import {
  REDIS_PREFIXES,
  RATE_LIMITS,
  RISK_THRESHOLDS,
  HMAC_TIMESTAMP_DRIFT_SECONDS,
  HMAC_NONCE_TTL_SECONDS,
  DATACENTER_CIDRS,
} from '../../src/config/constants.js';

describe('constants', () => {
  describe('REDIS_PREFIXES', () => {
    it('defines all required prefixes', () => {
      expect(REDIS_PREFIXES.RATE_LIMIT).toBe('rl');
      expect(REDIS_PREFIXES.OTP).toBe('otp');
      expect(REDIS_PREFIXES.OTP_COOLDOWN).toBe('otp:cooldown');
      expect(REDIS_PREFIXES.PREFLIGHT_JTI).toBe('preflight:jti');
      expect(REDIS_PREFIXES.POW_CHALLENGE).toBe('pow');
      expect(REDIS_PREFIXES.HMAC_NONCE).toBe('hmac:nonce');
      expect(REDIS_PREFIXES.RISK_VELOCITY).toBe('risk:velocity');
      expect(REDIS_PREFIXES.RISK_FAIL).toBe('risk:fail');
      expect(REDIS_PREFIXES.DEVICE_PHONES).toBe('device:phones');
      expect(REDIS_PREFIXES.ATTESTATION).toBe('attest');
      expect(REDIS_PREFIXES.SESSION_REVOKED).toBe('session:revoked');
    });

    it('has unique prefix values', () => {
      const values = Object.values(REDIS_PREFIXES);
      const uniqueValues = new Set(values);
      expect(uniqueValues.size).toBe(values.length);
    });
  });

  describe('RATE_LIMITS', () => {
    it('defines limits for preflight endpoint', () => {
      expect(RATE_LIMITS.preflight.ip.max).toBeGreaterThan(0);
      expect(RATE_LIMITS.preflight.ip.windowSec).toBeGreaterThan(0);
      expect(RATE_LIMITS.preflight.device.max).toBeGreaterThan(0);
    });

    it('defines limits for otp-send endpoint', () => {
      expect(RATE_LIMITS['otp-send'].phone.max).toBe(5); // max 5 sends per hour
      expect(RATE_LIMITS['otp-send'].phone.windowSec).toBe(3600);
    });

    it('defines limits for otp-verify endpoint', () => {
      expect(RATE_LIMITS['otp-verify'].phone.max).toBeGreaterThan(0);
    });

    it('otp-send per-phone limit is stricter than per-IP', () => {
      expect(RATE_LIMITS['otp-send'].phone.max).toBeLessThan(RATE_LIMITS['otp-send'].ip.max);
    });
  });

  describe('RISK_THRESHOLDS', () => {
    it('LOW < MID', () => {
      expect(RISK_THRESHOLDS.LOW).toBeLessThan(RISK_THRESHOLDS.MID);
    });

    it('LOW is 30', () => {
      expect(RISK_THRESHOLDS.LOW).toBe(30);
    });

    it('MID is 60', () => {
      expect(RISK_THRESHOLDS.MID).toBe(60);
    });
  });

  describe('HMAC settings', () => {
    it('timestamp drift is 30 seconds', () => {
      expect(HMAC_TIMESTAMP_DRIFT_SECONDS).toBe(30);
    });

    it('nonce TTL is 60 seconds', () => {
      expect(HMAC_NONCE_TTL_SECONDS).toBe(60);
    });

    it('nonce TTL > timestamp drift (prevents replay gap)', () => {
      expect(HMAC_NONCE_TTL_SECONDS).toBeGreaterThan(HMAC_TIMESTAMP_DRIFT_SECONDS);
    });
  });

  describe('DATACENTER_CIDRS', () => {
    it('contains known datacenter ranges', () => {
      expect(DATACENTER_CIDRS).toContain('52.0.0.0/11'); // AWS
      expect(DATACENTER_CIDRS).toContain('35.192.0.0/11'); // GCP
      expect(DATACENTER_CIDRS).toContain('13.64.0.0/11'); // Azure
    });

    it('contains valid CIDR notation', () => {
      for (const cidr of DATACENTER_CIDRS) {
        expect(cidr).toMatch(/^\d+\.\d+\.\d+\.\d+\/\d+$/);
      }
    });
  });
});
