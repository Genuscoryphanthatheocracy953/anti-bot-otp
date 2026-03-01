import pg from 'pg';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { REDIS_PREFIXES } from '../config/constants.js';
import { randomUUID } from '../utils/crypto.js';
import type { SessionPayload } from '../types/auth.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL = '7d';

export async function createSession(
  pool: pg.Pool,
  params: {
    phone: string;
    deviceId: string;
    channel: string;
    ip: string;
  },
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessJti = randomUUID();
  const refreshJti = randomUUID();

  const accessToken = jwt.sign(
    {
      jti: accessJti,
      sub: params.phone,
      device_id: params.deviceId,
      channel: params.channel,
    } satisfies Omit<SessionPayload, 'iat' | 'exp'>,
    env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_TTL },
  );

  const refreshToken = jwt.sign(
    {
      jti: refreshJti,
      sub: params.phone,
      device_id: params.deviceId,
      type: 'refresh',
    },
    env.REFRESH_TOKEN_SECRET,
    { expiresIn: REFRESH_TOKEN_TTL },
  );

  // Store session in DB
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  await pool.query(
    `INSERT INTO sessions (phone, device_id, access_token_jti, refresh_token_jti, ip_address, channel, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [params.phone, params.deviceId, accessJti, refreshJti, params.ip, params.channel, expiresAt],
  );

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): SessionPayload {
  return jwt.verify(token, env.JWT_SECRET) as SessionPayload;
}

export async function isSessionRevoked(redis: Redis, jti: string): Promise<boolean> {
  const key = `${REDIS_PREFIXES.SESSION_REVOKED}:${jti}`;
  return (await redis.exists(key)) === 1;
}
