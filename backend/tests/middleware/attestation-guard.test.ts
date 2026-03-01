import { describe, it, expect, vi, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

vi.mock('../../src/config/env.js', () => ({
  env: {
    ATTESTATION_SECRET: 'test_attestation_secret_that_is_at_least_32_chars_long_yes',
  },
}));

import { attestationGuardHook } from '../../src/middleware/attestation-guard.js';

describe('attestation guard middleware', () => {
  const ATTESTATION_SECRET = 'test_attestation_secret_that_is_at_least_32_chars_long_yes';

  function makeValidToken(deviceId: string): string {
    return jwt.sign(
      { device_id: deviceId, app_id: 'com.otppoc.app', type: 'attestation' },
      ATTESTATION_SECRET,
      { expiresIn: '24h' },
    );
  }

  function makeRequest(channel: string, token?: string, deviceId = 'device-1') {
    return {
      ctx: {
        channel,
        deviceId,
      },
      headers: {
        'x-attestation-token': token,
      },
    } as any;
  }

  it('skips for web channel', async () => {
    const request = makeRequest('web');
    await expect(attestationGuardHook(request, {} as any)).resolves.toBeUndefined();
  });

  it('passes for mobile with valid attestation token', async () => {
    const token = makeValidToken('device-1');
    const request = makeRequest('mobile', token);

    await expect(attestationGuardHook(request, {} as any)).resolves.toBeUndefined();
  });

  it('throws 401 for mobile without token', async () => {
    const request = makeRequest('mobile');
    await expect(attestationGuardHook(request, {} as any)).rejects.toThrow('Valid attestation token required');
  });

  it('throws 401 for mobile with invalid token', async () => {
    const request = makeRequest('mobile', 'invalid.jwt.here');
    await expect(attestationGuardHook(request, {} as any)).rejects.toThrow('Valid attestation token required');
  });

  it('throws 401 when device_id mismatches token', async () => {
    const token = makeValidToken('device-A');
    const request = makeRequest('mobile', token, 'device-B');

    await expect(attestationGuardHook(request, {} as any)).rejects.toThrow('Valid attestation token required');
  });

  it('throws 401 for expired attestation token', async () => {
    const token = jwt.sign(
      { device_id: 'device-1', app_id: 'app', type: 'attestation' },
      ATTESTATION_SECRET,
      { expiresIn: '-1h' }, // Already expired
    );
    const request = makeRequest('mobile', token);

    await expect(attestationGuardHook(request, {} as any)).rejects.toThrow();
  });

  it('throws 401 for token with wrong type', async () => {
    const token = jwt.sign(
      { device_id: 'device-1', app_id: 'app', type: 'not_attestation' },
      ATTESTATION_SECRET,
    );
    const request = makeRequest('mobile', token);

    await expect(attestationGuardHook(request, {} as any)).rejects.toThrow();
  });
});
