import Redis from 'ioredis';
import { env } from '../config/env.js';
import { REDIS_PREFIXES } from '../config/constants.js';
import { randomUUID, sha256 } from '../utils/crypto.js';
import { PreflightPayload } from '../types/auth.js';
import jwt from 'jsonwebtoken';

export function issuePreflight(params: {
  deviceId: string;
  ip: string;
  channel: 'web' | 'mobile';
  riskScore: number;
}): { token: string; payload: PreflightPayload } {
  const now = Math.floor(Date.now() / 1000);
  const payload: PreflightPayload = {
    jti: randomUUID(),
    session_id: randomUUID(),
    device_id: params.deviceId,
    ip_hash: sha256(params.ip),
    channel: params.channel,
    risk_score: params.riskScore,
    iat: now,
    exp: now + env.PREFLIGHT_TTL_SECONDS,
  };

  const token = jwt.sign(payload, env.PREFLIGHT_SECRET, { algorithm: 'HS256' });
  return { token, payload };
}

export async function consumePreflight(
  redis: Redis,
  token: string,
  currentIp: string,
  currentDeviceId: string,
): Promise<PreflightPayload> {
  // Verify signature and expiry
  const payload = jwt.verify(token, env.PREFLIGHT_SECRET) as PreflightPayload;

  // Verify IP binding
  if (payload.ip_hash !== sha256(currentIp)) {
    throw new Error('IP mismatch');
  }

  // Verify device binding
  if (payload.device_id !== currentDeviceId) {
    throw new Error('Device mismatch');
  }

  // One-time use: check and delete JTI
  const jtiKey = `${REDIS_PREFIXES.PREFLIGHT_JTI}:${payload.jti}`;
  const wasSet = await redis.set(jtiKey, '1', 'EX', env.PREFLIGHT_TTL_SECONDS, 'NX');
  if (!wasSet) {
    throw new Error('Preflight token already used');
  }

  return payload;
}

export async function storePreflight(redis: Redis, jti: string): Promise<void> {
  // Mark JTI as issued (for tracking, not for consumption check)
  const key = `${REDIS_PREFIXES.PREFLIGHT_JTI}:issued:${jti}`;
  await redis.set(key, '1', 'EX', env.PREFLIGHT_TTL_SECONDS);
}
