import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAttestationJwt } from '../services/attestation.service.js';
import { AttestationRequiredError } from '../utils/errors.js';

export async function attestationGuardHook(request: FastifyRequest, _reply: FastifyReply) {
  if (request.ctx.channel !== 'mobile') {
    return; // Only required for mobile
  }

  const token = request.headers['x-attestation-token'] as string;
  if (!token) {
    throw new AttestationRequiredError();
  }

  try {
    const { device_id } = verifyAttestationJwt(token);
    if (device_id !== request.ctx.deviceId) {
      throw new Error('Attestation device mismatch');
    }
  } catch {
    throw new AttestationRequiredError();
  }
}
