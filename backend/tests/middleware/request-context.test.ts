import { describe, it, expect } from 'vitest';
import { extractRequestContext } from '../../src/middleware/request-context.js';

describe('request context middleware', () => {
  function makeRequest(overrides: Record<string, unknown> = {}) {
    return {
      ip: '192.168.1.100',
      headers: {
        'x-device-id': 'device-abc',
        'x-channel': 'web',
        'x-fingerprint': 'fp-hash-xyz',
        'user-agent': 'Mozilla/5.0 (Macintosh)',
        'accept-language': 'en-US,en;q=0.9',
        ...overrides,
      },
    } as any;
  }

  it('extracts all context fields', () => {
    const ctx = extractRequestContext(makeRequest());

    expect(ctx.ip).toBe('192.168.1.100');
    expect(ctx.subnet).toBe('192.168.1.0/24');
    expect(ctx.deviceId).toBe('device-abc');
    expect(ctx.channel).toBe('web');
    expect(ctx.fingerprint).toBe('fp-hash-xyz');
    expect(ctx.userAgent).toBe('Mozilla/5.0 (Macintosh)');
    expect(ctx.acceptLanguage).toBe('en-US,en;q=0.9');
  });

  it('defaults deviceId to "unknown" when missing', () => {
    const ctx = extractRequestContext(makeRequest({ 'x-device-id': undefined }));
    expect(ctx.deviceId).toBe('unknown');
  });

  it('defaults channel to "web" when missing', () => {
    const ctx = extractRequestContext(makeRequest({ 'x-channel': undefined }));
    expect(ctx.channel).toBe('web');
  });

  it('sets channel to "mobile" from header', () => {
    const ctx = extractRequestContext(makeRequest({ 'x-channel': 'mobile' }));
    expect(ctx.channel).toBe('mobile');
  });

  it('uses X-Forwarded-For when present', () => {
    const ctx = extractRequestContext(makeRequest({
      'x-forwarded-for': '203.0.113.50',
    }));
    expect(ctx.ip).toBe('203.0.113.50');
  });

  it('extracts correct /24 subnet', () => {
    const ctx = extractRequestContext({
      ip: '10.0.5.237',
      headers: {},
    } as any);
    expect(ctx.subnet).toBe('10.0.5.0/24');
  });

  it('returns undefined fingerprint when header missing', () => {
    const ctx = extractRequestContext(makeRequest({ 'x-fingerprint': undefined }));
    expect(ctx.fingerprint).toBeUndefined();
  });
});
