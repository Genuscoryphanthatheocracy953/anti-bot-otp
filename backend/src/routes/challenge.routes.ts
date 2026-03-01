import { FastifyInstance } from 'fastify';
import { issueChallenge, verifySolution } from '../services/pow.service.js';
import { verifyCaptchaToken } from '../services/captcha.service.js';
import { recordFailure } from '../services/risk.service.js';
import { AppError } from '../utils/errors.js';
import { getRedis } from '../plugins/redis.js';

export async function challengeRoutes(fastify: FastifyInstance) {
  const redis = getRedis();

  // POST /v1/challenge/pow/issue
  fastify.post('/v1/challenge/pow/issue', async (request) => {
    const body = request.body as { device_id: string; difficulty?: number };

    if (!body.device_id) {
      throw new AppError(400, 'INVALID_REQUEST', 'device_id is required');
    }

    const challenge = await issueChallenge(redis, body.device_id, body.difficulty);

    return {
      success: true,
      data: {
        nonce: challenge.nonce,
        difficulty: challenge.difficulty,
        challenge_id: challenge.challenge_id,
      },
    };
  });

  // POST /v1/challenge/pow/verify
  fastify.post('/v1/challenge/pow/verify', async (request) => {
    const body = request.body as { nonce: string; solution: string; challenge_id: string };

    if (!body.nonce || !body.solution || !body.challenge_id) {
      throw new AppError(400, 'INVALID_REQUEST', 'nonce, solution, and challenge_id are required');
    }

    const valid = await verifySolution(redis, body);

    if (!valid) {
      await recordFailure(redis, 'pow', request.ctx.deviceId);
      throw new AppError(400, 'INVALID_POW', 'Invalid proof-of-work solution');
    }

    return { success: true, data: { verified: true } };
  });

  // POST /v1/challenge/captcha/verify
  fastify.post('/v1/challenge/captcha/verify', async (request) => {
    const body = request.body as { token: string };

    if (!body.token) {
      throw new AppError(400, 'INVALID_REQUEST', 'token is required');
    }

    const valid = verifyCaptchaToken(body.token);

    if (!valid) {
      await recordFailure(redis, 'captcha', request.ctx.deviceId);
      throw new AppError(400, 'INVALID_CAPTCHA', 'Invalid CAPTCHA token. Hint: use "pass" in PoC mode.');
    }

    return { success: true, data: { verified: true } };
  });
}
