import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRedis, MockRedis } from '../helpers/mock-redis.js';

vi.mock('../../src/config/env.js', () => ({
  env: {
    HMAC_CLIENT_KEY: 'test_hmac_key_that_is_at_least_32_characters_long',
  },
}));

import { createHmacVerifyHook } from '../../src/middleware/hmac-verify.js';
import { computeSignature } from '../../src/services/hmac.service.js';
import { sha256 } from '../../src/utils/crypto.js';

describe('HMAC verify middleware', () => {
  let redis: MockRedis;

  beforeEach(() => {
    redis = createMockRedis();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function makeRequest(overrides: Record<string, unknown> = {}) {
    const now = Math.floor(Date.now() / 1000).toString();
    const body = { test: true };
    const rawBody = JSON.stringify(body);
    const bodyHash = sha256(rawBody);
    const signature = computeSignature('POST', '/v1/auth/preflight', now, bodyHash);

    return {
      method: 'POST',
      url: '/v1/auth/preflight',
      headers: {
        'x-signature': signature,
        'x-timestamp': now,
        'x-nonce': 'unique-nonce-' + Math.random(),
        ...overrides,
      },
      body,
      rawBody,
    } as any;
  }

  it('passes with valid HMAC headers', async () => {
    const hook = createHmacVerifyHook(redis as any);
    const request = makeRequest();
    const reply = {} as any;

    await expect(hook(request, reply)).resolves.toBeUndefined();
  });

  it('throws when x-signature is missing', async () => {
    const hook = createHmacVerifyHook(redis as any);
    const request = makeRequest({ 'x-signature': undefined });
    const reply = {} as any;

    await expect(hook(request, reply)).rejects.toThrow();
  });

  it('throws when x-timestamp is missing', async () => {
    const hook = createHmacVerifyHook(redis as any);
    const request = makeRequest({ 'x-timestamp': undefined });
    const reply = {} as any;

    await expect(hook(request, reply)).rejects.toThrow();
  });

  it('throws when x-nonce is missing', async () => {
    const hook = createHmacVerifyHook(redis as any);
    const request = makeRequest({ 'x-nonce': undefined });
    const reply = {} as any;

    await expect(hook(request, reply)).rejects.toThrow();
  });

  it('throws with tampered signature', async () => {
    const hook = createHmacVerifyHook(redis as any);
    const request = makeRequest({ 'x-signature': 'deadbeef' });
    const reply = {} as any;

    await expect(hook(request, reply)).rejects.toThrow();
  });

  it('handles request with no body', async () => {
    const hook = createHmacVerifyHook(redis as any);
    const now = Math.floor(Date.now() / 1000).toString();
    const bodyHash = sha256('');
    const signature = computeSignature('GET', '/v1/auth/session/me', now, bodyHash);

    const request = {
      method: 'GET',
      url: '/v1/auth/session/me',
      headers: {
        'x-signature': signature,
        'x-timestamp': now,
        'x-nonce': 'nonce-no-body',
      },
      body: null,
      rawBody: undefined,
    } as any;

    await expect(hook(request, {} as any)).resolves.toBeUndefined();
  });

  it('strips query params from path before verification', async () => {
    const hook = createHmacVerifyHook(redis as any);
    const now = Math.floor(Date.now() / 1000).toString();
    const bodyHash = sha256('');
    const signature = computeSignature('GET', '/v1/auth/session/me', now, bodyHash);

    const request = {
      method: 'GET',
      url: '/v1/auth/session/me?foo=bar',
      headers: {
        'x-signature': signature,
        'x-timestamp': now,
        'x-nonce': 'nonce-query',
      },
      body: null,
      rawBody: undefined,
    } as any;

    await expect(hook(request, {} as any)).resolves.toBeUndefined();
  });
});
