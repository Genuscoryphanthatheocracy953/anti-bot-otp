import { describe, it, expect } from 'vitest';
import { normalizePhone, validateE164, maskPhone } from '../../src/utils/phone.js';

describe('phone utilities', () => {
  describe('normalizePhone', () => {
    it('strips spaces', () => {
      expect(normalizePhone('+1 234 567 8901')).toBe('+12345678901');
    });

    it('strips dashes', () => {
      expect(normalizePhone('+1-234-567-8901')).toBe('+12345678901');
    });

    it('strips parentheses', () => {
      expect(normalizePhone('+1(234)567-8901')).toBe('+12345678901');
    });

    it('adds + prefix if missing', () => {
      expect(normalizePhone('12345678901')).toBe('+12345678901');
    });

    it('keeps existing + prefix', () => {
      expect(normalizePhone('+12345678901')).toBe('+12345678901');
    });

    it('handles Jordanian number format', () => {
      expect(normalizePhone('+962 79 208 4410')).toBe('+962792084410');
    });

    it('handles mixed delimiters', () => {
      expect(normalizePhone('+1 (555) 123-4567')).toBe('+15551234567');
    });
  });

  describe('validateE164', () => {
    it('accepts valid E.164 numbers', () => {
      expect(validateE164('+12345678901')).toBe(true);
      expect(validateE164('+962792084410')).toBe(true);
      expect(validateE164('+447911123456')).toBe(true);
    });

    it('rejects numbers without + prefix', () => {
      expect(validateE164('12345678901')).toBe(false);
    });

    it('rejects numbers starting with +0', () => {
      expect(validateE164('+0123456789')).toBe(false);
    });

    it('rejects too short numbers', () => {
      expect(validateE164('+12345')).toBe(false);
    });

    it('rejects too long numbers (>15 digits)', () => {
      expect(validateE164('+1234567890123456')).toBe(false);
    });

    it('rejects numbers with non-digit characters', () => {
      expect(validateE164('+1234abc5678')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(validateE164('')).toBe(false);
    });

    it('rejects just a plus sign', () => {
      expect(validateE164('+')).toBe(false);
    });
  });

  describe('maskPhone', () => {
    it('masks middle of phone number', () => {
      const masked = maskPhone('+962792084410');
      expect(masked).toBe('+962****10');
    });

    it('shows first 4 and last 2 characters', () => {
      const masked = maskPhone('+12345678901');
      expect(masked).toBe('+123****01');
    });

    it('handles short numbers gracefully', () => {
      expect(maskPhone('+123')).toBe('***');
    });

    it('handles very short input', () => {
      expect(maskPhone('ab')).toBe('***');
    });
  });
});
