import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'node:crypto';
import { createMockRedis, MockRedis } from '../helpers/mock-redis.js';

vi.mock('../../src/config/env.js', () => ({
  env: {
    ATTESTATION_SECRET: 'test_attestation_secret_that_is_at_least_32_chars_long_yes',
  },
}));

import {
  issueAttestationChallenge,
  verifyAttestationResponse,
  verifyAttestationJwt,
} from '../../src/services/attestation.service.js';

describe('attestation service', () => {
  let redis: MockRedis;

  beforeEach(() => {
    redis = createMockRedis();
  });

  describe('issueAttestationChallenge', () => {
    it('returns challenge and challenge_id', async () => {
      const { challenge, challenge_id } = await issueAttestationChallenge(redis as any, 'device-1');

      expect(challenge).toBeTruthy();
      expect(challenge_id).toBeTruthy();
    });

    it('stores challenge in Redis with 300s TTL', async () => {
      await issueAttestationChallenge(redis as any, 'device-1');

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('attest:challenge:'),
        expect.any(String),
        'EX',
        300,
      );
    });

    it('binds challenge to device_id', async () => {
      await issueAttestationChallenge(redis as any, 'dev-abc');

      const storedCall = redis.set.mock.calls[0];
      const stored = JSON.parse(storedCall[1] as string);
      expect(stored.device_id).toBe('dev-abc');
    });
  });

  describe('verifyAttestationResponse', () => {
    async function setupAttestation() {
      // Generate P256 key pair
      const { publicKey, privateKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'P-256',
      });

      const { challenge, challenge_id } = await issueAttestationChallenge(redis as any, 'device-1');

      // Sign the challenge
      const signer = crypto.createSign('SHA256');
      signer.update(challenge);
      const signedResponse = signer.sign(privateKey, 'base64');

      const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

      // Set up Redis to return the stored challenge
      const storedCall = redis.set.mock.calls[0];
      redis.get.mockResolvedValueOnce(storedCall[1] as string);

      return {
        challenge,
        challenge_id,
        signedResponse,
        publicKeyPem,
      };
    }

    it('verifies valid attestation and returns JWT', async () => {
      const { challenge, challenge_id, signedResponse, publicKeyPem } = await setupAttestation();

      const { attestation_jwt } = await verifyAttestationResponse(redis as any, {
        challenge_id,
        device_id: 'device-1',
        challenge,
        signed_response: signedResponse,
        public_key: publicKeyPem,
        app_id: 'com.otppoc.app',
      });

      expect(attestation_jwt).toBeTruthy();
    });

    it('JWT contains device_id and app_id', async () => {
      const { challenge, challenge_id, signedResponse, publicKeyPem } = await setupAttestation();

      const { attestation_jwt } = await verifyAttestationResponse(redis as any, {
        challenge_id,
        device_id: 'device-1',
        challenge,
        signed_response: signedResponse,
        public_key: publicKeyPem,
        app_id: 'com.otppoc.app',
      });

      const decoded = verifyAttestationJwt(attestation_jwt);
      expect(decoded.device_id).toBe('device-1');
      expect(decoded.app_id).toBe('com.otppoc.app');
    });

    it('rejects expired challenge', async () => {
      redis.get.mockResolvedValueOnce(null);

      await expect(
        verifyAttestationResponse(redis as any, {
          challenge_id: 'expired-id',
          device_id: 'device-1',
          challenge: 'challenge',
          signed_response: 'sig',
          public_key: 'key',
          app_id: 'app',
        }),
      ).rejects.toThrow('Challenge expired');
    });

    it('rejects device_id mismatch', async () => {
      await issueAttestationChallenge(redis as any, 'device-1');
      const storedCall = redis.set.mock.calls[0];
      redis.get.mockResolvedValueOnce(storedCall[1] as string);

      await expect(
        verifyAttestationResponse(redis as any, {
          challenge_id: 'some-id',
          device_id: 'wrong-device',
          challenge: 'challenge',
          signed_response: 'sig',
          public_key: 'key',
          app_id: 'app',
        }),
      ).rejects.toThrow('Device mismatch');
    });

    it('rejects invalid signature', async () => {
      const { challenge, challenge_id, publicKeyPem } = await setupAttestation();

      // Reset mock to return challenge again
      const storedCall = redis.set.mock.calls[0];
      redis.get.mockResolvedValueOnce(storedCall[1] as string);

      await expect(
        verifyAttestationResponse(redis as any, {
          challenge_id,
          device_id: 'device-1',
          challenge,
          signed_response: 'aW52YWxpZA==', // invalid base64 signature
          public_key: publicKeyPem,
          app_id: 'com.otppoc.app',
        }),
      ).rejects.toThrow();
    });

    it('consumes challenge after verification', async () => {
      const { challenge, challenge_id, signedResponse, publicKeyPem } = await setupAttestation();

      await verifyAttestationResponse(redis as any, {
        challenge_id,
        device_id: 'device-1',
        challenge,
        signed_response: signedResponse,
        public_key: publicKeyPem,
        app_id: 'com.otppoc.app',
      });

      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining('attest:challenge:'),
      );
    });

    it('stores attestation data in Redis with 24h TTL', async () => {
      const { challenge, challenge_id, signedResponse, publicKeyPem } = await setupAttestation();

      await verifyAttestationResponse(redis as any, {
        challenge_id,
        device_id: 'device-1',
        challenge,
        signed_response: signedResponse,
        public_key: publicKeyPem,
        app_id: 'com.otppoc.app',
      });

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining('attest:device-1'),
        expect.any(String),
        'EX',
        86400,
      );
    });
  });

  describe('verifyAttestationJwt', () => {
    it('rejects invalid JWT', () => {
      expect(() => verifyAttestationJwt('invalid.jwt.token')).toThrow();
    });

    it('rejects JWT with wrong type', () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { device_id: 'd1', app_id: 'a1', type: 'wrong' },
        'test_attestation_secret_that_is_at_least_32_chars_long_yes',
      );
      expect(() => verifyAttestationJwt(token)).toThrow('Invalid attestation token type');
    });

    it('rejects JWT signed with wrong secret', () => {
      const jwt = require('jsonwebtoken');
      const token = jwt.sign(
        { device_id: 'd1', app_id: 'a1', type: 'attestation' },
        'wrong_secret',
      );
      expect(() => verifyAttestationJwt(token)).toThrow();
    });
  });
});
