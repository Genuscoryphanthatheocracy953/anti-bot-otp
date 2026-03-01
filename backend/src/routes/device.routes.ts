import { FastifyInstance } from 'fastify';
import {
  issueAttestationChallenge,
  verifyAttestationResponse,
} from '../services/attestation.service.js';
import { recordFailure } from '../services/risk.service.js';
import { AppError } from '../utils/errors.js';
import { getRedis } from '../plugins/redis.js';

export async function deviceRoutes(fastify: FastifyInstance) {
  const redis = getRedis();

  // POST /v1/device/attest — get a challenge for device attestation
  fastify.post('/v1/device/attest', async (request) => {
    const body = request.body as { device_id: string };

    if (!body.device_id) {
      throw new AppError(400, 'INVALID_REQUEST', 'device_id is required');
    }

    const { challenge, challenge_id } = await issueAttestationChallenge(redis, body.device_id);

    return {
      success: true,
      data: { challenge, challenge_id },
    };
  });

  // POST /v1/device/attest/verify — verify signed attestation response
  fastify.post('/v1/device/attest/verify', async (request) => {
    const body = request.body as {
      challenge_id: string;
      device_id: string;
      challenge: string;
      signed_response: string;
      public_key: string;
      app_id: string;
    };

    if (!body.challenge_id || !body.device_id || !body.challenge || !body.signed_response || !body.public_key || !body.app_id) {
      throw new AppError(400, 'INVALID_REQUEST', 'All attestation fields are required');
    }

    try {
      const { attestation_jwt } = await verifyAttestationResponse(redis, body);

      return {
        success: true,
        data: {
          attestation_jwt,
          expires_in: 86400,
          note: 'STUB: In production, replace with Play Integrity / iOS App Attest',
        },
      };
    } catch (err) {
      await recordFailure(redis, 'attest', body.device_id);
      throw new AppError(401, 'ATTESTATION_FAILED', (err as Error).message);
    }
  });
}
