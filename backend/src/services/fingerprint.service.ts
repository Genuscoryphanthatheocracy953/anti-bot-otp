import { sha256 } from '../utils/crypto.js';

export interface FingerprintData {
  userAgent?: string;
  acceptLanguage?: string;
  timezone?: string;
  screen?: string;
  cookieId?: string;
}

export function hashFingerprint(data: FingerprintData): string {
  const raw = [
    data.userAgent || '',
    data.acceptLanguage || '',
    data.timezone || '',
    data.screen || '',
    data.cookieId || '',
  ].join('|');

  return sha256(raw);
}

export function extractFingerprintFromHeaders(headers: Record<string, string | string[] | undefined>): string | undefined {
  const fp = headers['x-fingerprint'];
  if (typeof fp === 'string' && fp.length > 0) {
    return fp;
  }
  return undefined;
}
