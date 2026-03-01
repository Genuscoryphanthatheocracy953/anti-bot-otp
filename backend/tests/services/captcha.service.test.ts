import { describe, it, expect } from 'vitest';
import { verifyCaptchaToken } from '../../src/services/captcha.service.js';

describe('CAPTCHA service (stub)', () => {
  it('accepts "pass" token', () => {
    expect(verifyCaptchaToken('pass')).toBe(true);
  });

  it('rejects empty string', () => {
    expect(verifyCaptchaToken('')).toBe(false);
  });

  it('rejects random token', () => {
    expect(verifyCaptchaToken('abc123')).toBe(false);
  });

  it('rejects "Pass" (case-sensitive)', () => {
    expect(verifyCaptchaToken('Pass')).toBe(false);
  });

  it('rejects "PASS"', () => {
    expect(verifyCaptchaToken('PASS')).toBe(false);
  });

  it('rejects token with whitespace', () => {
    expect(verifyCaptchaToken(' pass ')).toBe(false);
  });
});
