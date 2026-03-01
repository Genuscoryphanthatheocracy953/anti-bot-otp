import { describe, it, expect } from 'vitest';
import {
  AppError,
  RateLimitError,
  PreflightRequiredError,
  InvalidSignatureError,
  RiskBlockedError,
  OtpExpiredError,
  OtpExhaustedError,
  AttestationRequiredError,
} from '../../src/utils/errors.js';

describe('error classes', () => {
  describe('AppError', () => {
    it('creates error with all fields', () => {
      const err = new AppError(400, 'TEST_CODE', 'test message', 60);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('TEST_CODE');
      expect(err.message).toBe('test message');
      expect(err.retryAfter).toBe(60);
      expect(err.name).toBe('AppError');
    });

    it('toJSON returns correct shape', () => {
      const err = new AppError(400, 'CODE', 'msg', 30);
      expect(err.toJSON()).toEqual({
        success: false,
        error: {
          code: 'CODE',
          message: 'msg',
          retry_after: 30,
        },
      });
    });

    it('toJSON omits retry_after when undefined', () => {
      const err = new AppError(400, 'CODE', 'msg');
      const json = err.toJSON();
      expect(json.error).not.toHaveProperty('retry_after');
    });

    it('extends Error', () => {
      const err = new AppError(500, 'X', 'y');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
    });
  });

  describe('RateLimitError', () => {
    it('has correct status and code', () => {
      const err = new RateLimitError(120);
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe('RATE_LIMITED');
      expect(err.retryAfter).toBe(120);
      expect(err).toBeInstanceOf(AppError);
    });
  });

  describe('PreflightRequiredError', () => {
    it('has correct status and code', () => {
      const err = new PreflightRequiredError();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('PREFLIGHT_REQUIRED');
    });
  });

  describe('InvalidSignatureError', () => {
    it('has correct status and code', () => {
      const err = new InvalidSignatureError();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('INVALID_SIGNATURE');
    });
  });

  describe('RiskBlockedError', () => {
    it('has correct status and code', () => {
      const err = new RiskBlockedError();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('RISK_BLOCKED');
    });
  });

  describe('OtpExpiredError', () => {
    it('has correct status and code', () => {
      const err = new OtpExpiredError();
      expect(err.statusCode).toBe(410);
      expect(err.code).toBe('OTP_EXPIRED');
    });
  });

  describe('OtpExhaustedError', () => {
    it('has correct status and code', () => {
      const err = new OtpExhaustedError();
      expect(err.statusCode).toBe(429);
      expect(err.code).toBe('OTP_EXHAUSTED');
    });
  });

  describe('AttestationRequiredError', () => {
    it('has correct status and code', () => {
      const err = new AttestationRequiredError();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('ATTESTATION_REQUIRED');
    });
  });
});
