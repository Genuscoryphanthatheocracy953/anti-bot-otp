import { describe, it, expect } from 'vitest';
import {
  hashFingerprint,
  extractFingerprintFromHeaders,
} from '../../src/services/fingerprint.service.js';

describe('fingerprint service', () => {
  describe('hashFingerprint', () => {
    it('produces consistent hash for same data', () => {
      const data = {
        userAgent: 'Mozilla/5.0',
        acceptLanguage: 'en-US',
        timezone: 'America/New_York',
        screen: '1920x1080',
        cookieId: 'abc123',
      };

      const h1 = hashFingerprint(data);
      const h2 = hashFingerprint(data);
      expect(h1).toBe(h2);
    });

    it('produces different hash for different data', () => {
      const h1 = hashFingerprint({ userAgent: 'Chrome', screen: '1920x1080' });
      const h2 = hashFingerprint({ userAgent: 'Firefox', screen: '1920x1080' });
      expect(h1).not.toBe(h2);
    });

    it('handles all-empty data', () => {
      const hash = hashFingerprint({});
      expect(hash).toBeTruthy();
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('returns hex SHA256 hash', () => {
      const hash = hashFingerprint({ userAgent: 'test' });
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('treats undefined fields as empty strings', () => {
      const h1 = hashFingerprint({ userAgent: undefined });
      const h2 = hashFingerprint({});
      expect(h1).toBe(h2);
    });
  });

  describe('extractFingerprintFromHeaders', () => {
    it('extracts x-fingerprint header', () => {
      const fp = extractFingerprintFromHeaders({
        'x-fingerprint': 'abc123hash',
      });
      expect(fp).toBe('abc123hash');
    });

    it('returns undefined when header is missing', () => {
      const fp = extractFingerprintFromHeaders({});
      expect(fp).toBeUndefined();
    });

    it('returns undefined for empty string', () => {
      const fp = extractFingerprintFromHeaders({
        'x-fingerprint': '',
      });
      expect(fp).toBeUndefined();
    });

    it('returns undefined for array value', () => {
      const fp = extractFingerprintFromHeaders({
        'x-fingerprint': ['a', 'b'],
      });
      expect(fp).toBeUndefined();
    });
  });
});
