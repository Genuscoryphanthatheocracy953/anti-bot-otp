import { FastifyInstance } from 'fastify';
import { issuePreflight, storePreflight } from '../services/preflight.service.js';
import { createAndStoreOtp, verifyOtp } from '../services/otp.service.js';
import { computeRiskScore } from '../services/risk.service.js';
import { sendOtpViaTelegram } from '../services/telegram.service.js';
import { createSession, verifyAccessToken, isSessionRevoked } from '../services/session.service.js';
import { issueChallenge } from '../services/pow.service.js';
import { createRateLimiter } from '../middleware/rate-limiter.js';
import { createPreflightGuard } from '../middleware/preflight-guard.js';
import { createRiskGate } from '../middleware/risk-gate.js';
import { attestationGuardHook } from '../middleware/attestation-guard.js';
import { normalizePhone, validateE164 } from '../utils/phone.js';
import { AppError } from '../utils/errors.js';
import { RISK_THRESHOLDS } from '../config/constants.js';
import { getRedis } from '../plugins/redis.js';
import { getPool } from '../plugins/postgres.js';

export async function authRoutes(fastify: FastifyInstance) {
  const redis = getRedis();
  const pg = getPool();

  // POST /v1/auth/preflight
  fastify.post('/v1/auth/preflight', {
    preHandler: [createRateLimiter(redis, 'preflight')],
  }, async (request, reply) => {
    const body = request.body as {
      channel: 'web' | 'mobile';
      device_id: string;
      fingerprint?: Record<string, string>;
      client_signals?: import('../types/risk.js').ClientSignals;
    };

    if (!body.channel || !body.device_id) {
      throw new AppError(400, 'INVALID_REQUEST', 'channel and device_id are required');
    }

    // Override ctx with body values
    request.ctx.channel = body.channel;
    request.ctx.deviceId = body.device_id;

    // Store client signals for downstream risk-gate
    request.ctx.clientSignals = body.client_signals;

    // Compute initial risk score
    const { score } = await computeRiskScore(redis, {
      ip: request.ctx.ip,
      subnet: request.ctx.subnet,
      deviceId: body.device_id,
      channel: body.channel,
      userAgent: request.ctx.userAgent,
      acceptLanguage: request.ctx.acceptLanguage,
      fingerprint: request.ctx.fingerprint,
      clientSignals: body.client_signals,
    });

    // Issue preflight token
    const { token, payload } = issuePreflight({
      deviceId: body.device_id,
      ip: request.ctx.ip,
      channel: body.channel,
      riskScore: score,
    });

    await storePreflight(redis, payload.jti);

    // Track device
    await pg.query(
      `INSERT INTO devices (id, channel, metadata)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE SET last_seen_at = NOW(), metadata = $3`,
      [body.device_id, body.channel, JSON.stringify({ userAgent: request.ctx.userAgent })],
    );

    // Audit
    await pg.query(
      `INSERT INTO audit_log (event_type, device_id, ip_address, risk_score, success, metadata)
       VALUES ('preflight', $1, $2, $3, true, $4)`,
      [body.device_id, request.ctx.ip, score, JSON.stringify({ session_id: payload.session_id })],
    );

    const response: Record<string, unknown> = {
      success: true,
      data: {
        token,
        session_id: payload.session_id,
        risk_score: score,
        expires_at: payload.exp,
      },
    };

    // If risk > LOW, include PoW challenge
    if (score > RISK_THRESHOLDS.LOW) {
      const powChallenge = await issueChallenge(redis, body.device_id);
      response.data = {
        ...(response.data as object),
        pow_challenge: {
          nonce: powChallenge.nonce,
          difficulty: powChallenge.difficulty,
          challenge_id: powChallenge.challenge_id,
        },
        requires_pow: true,
        requires_captcha: true,
      };
    }

    return response;
  });

  // POST /v1/auth/otp/send
  fastify.post('/v1/auth/otp/send', {
    preHandler: [
      createRateLimiter(redis, 'otp-send'),
      createPreflightGuard(redis),
      attestationGuardHook,
      createRiskGate(redis),
    ],
  }, async (request, reply) => {
    const body = request.body as { phone: string; purpose?: 'login' | 'signup' };

    if (!body.phone) {
      throw new AppError(400, 'INVALID_REQUEST', 'phone is required');
    }

    const phone = normalizePhone(body.phone);
    if (!validateE164(phone)) {
      throw new AppError(400, 'INVALID_PHONE', 'Phone number must be in E.164 format');
    }

    const purpose = body.purpose || 'login';
    const riskScore = (request as any).riskScore ?? request.preflight.risk_score;

    const { otp, challengeId, expiresAt } = await createAndStoreOtp(redis, pg, {
      phone,
      purpose,
      deviceId: request.ctx.deviceId,
      channel: request.ctx.channel,
      ip: request.ctx.ip,
      riskScore,
    });

    // Send OTP via Telegram
    await sendOtpViaTelegram({ phone, otp, challengeId, expiresAt });

    // Audit
    await pg.query(
      `INSERT INTO audit_log (event_type, phone, device_id, ip_address, risk_score, success, metadata)
       VALUES ('otp_send', $1, $2, $3, $4, true, $5)`,
      [phone, request.ctx.deviceId, request.ctx.ip, riskScore, JSON.stringify({ challenge_id: challengeId })],
    );

    return {
      success: true,
      data: {
        challenge_id: challengeId,
        expires_at: expiresAt,
        purpose,
      },
    };
  });

  // POST /v1/auth/otp/verify
  fastify.post('/v1/auth/otp/verify', {
    preHandler: [createRateLimiter(redis, 'otp-verify')],
  }, async (request, reply) => {
    const body = request.body as {
      phone: string;
      code: string;
      challenge_id: string;
      device_id: string;
      purpose?: string;
    };

    if (!body.phone || !body.code || !body.challenge_id || !body.device_id) {
      throw new AppError(400, 'INVALID_REQUEST', 'phone, code, challenge_id, and device_id are required');
    }

    const phone = normalizePhone(body.phone);
    const purpose = body.purpose || 'login';

    const { verified } = await verifyOtp(redis, pg, {
      phone,
      code: body.code,
      challengeId: body.challenge_id,
      deviceId: body.device_id,
      purpose,
    });

    // Audit
    await pg.query(
      `INSERT INTO audit_log (event_type, phone, device_id, ip_address, success, metadata)
       VALUES ('otp_verify', $1, $2, $3, $4, $5)`,
      [phone, body.device_id, request.ctx.ip, verified, JSON.stringify({ challenge_id: body.challenge_id })],
    );

    if (!verified) {
      throw new AppError(401, 'INVALID_OTP', 'Invalid OTP code');
    }

    // Issue session tokens
    const { accessToken, refreshToken } = await createSession(pg, {
      phone,
      deviceId: body.device_id,
      channel: request.ctx.channel,
      ip: request.ctx.ip,
    });

    // Set refresh token as httpOnly cookie for web
    if (request.ctx.channel === 'web') {
      reply.setCookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: false, // localhost PoC
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });
    }

    return {
      success: true,
      data: {
        access_token: accessToken,
        refresh_token: request.ctx.channel === 'mobile' ? refreshToken : undefined,
        token_type: 'Bearer',
        expires_in: 900, // 15 minutes
      },
    };
  });

  // GET /v1/auth/session/me
  fastify.get('/v1/auth/session/me', async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AppError(401, 'UNAUTHORIZED', 'Missing or invalid authorization header');
    }

    const token = authHeader.slice(7);

    try {
      const payload = verifyAccessToken(token);

      // Check revocation
      const revoked = await isSessionRevoked(redis, payload.jti);
      if (revoked) {
        throw new Error('Session revoked');
      }

      return {
        success: true,
        data: {
          phone: payload.sub,
          device_id: payload.device_id,
          channel: payload.channel,
          issued_at: payload.iat,
          expires_at: payload.exp,
        },
      };
    } catch {
      throw new AppError(401, 'INVALID_SESSION', 'Session is invalid or expired');
    }
  });
}
