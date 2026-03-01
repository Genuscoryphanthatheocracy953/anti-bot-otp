import { FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';
import { RISK_THRESHOLDS } from '../config/constants.js';
import { computeRiskScore, recordFailure } from '../services/risk.service.js';
import { verifySolution } from '../services/pow.service.js';
import { verifyCaptchaToken } from '../services/captcha.service.js';
import { AppError, RiskBlockedError } from '../utils/errors.js';

export function createRiskGate(redis: Redis) {
  return async function riskGateHook(request: FastifyRequest, _reply: FastifyReply) {
    const body = request.body as Record<string, unknown> | undefined;
    const phone = body?.phone as string | undefined;

    const { score, factors } = await computeRiskScore(redis, {
      ip: request.ctx.ip,
      subnet: request.ctx.subnet,
      deviceId: request.ctx.deviceId,
      channel: request.ctx.channel,
      userAgent: request.ctx.userAgent,
      acceptLanguage: request.ctx.acceptLanguage,
      fingerprint: request.ctx.fingerprint,
      phone,
      clientSignals: request.ctx.clientSignals,
    });

    // Attach to request for logging/auditing
    (request as any).riskScore = score;
    (request as any).riskFactors = factors;

    // > 60: block
    if (score > RISK_THRESHOLDS.MID) {
      throw new RiskBlockedError();
    }

    // 31-60: require PoW + CAPTCHA
    if (score > RISK_THRESHOLDS.LOW) {
      // Check PoW
      const powSolution = body?.pow_solution as { nonce: string; solution: string; challenge_id: string } | undefined;
      if (!powSolution) {
        throw new AppError(428, 'POW_REQUIRED', 'Proof-of-work solution required for this request');
      }

      const powValid = await verifySolution(redis, powSolution);
      if (!powValid) {
        await recordFailure(redis, 'pow', request.ctx.deviceId);
        throw new AppError(400, 'INVALID_POW', 'Invalid proof-of-work solution');
      }

      // Check CAPTCHA
      const captchaToken = body?.captcha_token as string | undefined;
      if (!captchaToken) {
        throw new AppError(428, 'CAPTCHA_REQUIRED', 'CAPTCHA verification required for this request');
      }

      if (!verifyCaptchaToken(captchaToken)) {
        await recordFailure(redis, 'captcha', request.ctx.deviceId);
        throw new AppError(400, 'INVALID_CAPTCHA', 'Invalid CAPTCHA token');
      }
    }
  };
}
