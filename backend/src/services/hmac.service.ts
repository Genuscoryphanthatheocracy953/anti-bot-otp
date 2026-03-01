import Redis from 'ioredis';
import { env } from '../config/env.js';
import { REDIS_PREFIXES, HMAC_TIMESTAMP_DRIFT_SECONDS, HMAC_NONCE_TTL_SECONDS } from '../config/constants.js';
import { hmacSha256, sha256 } from '../utils/crypto.js';
import { InvalidSignatureError } from '../utils/errors.js';

export interface HmacParams {
  method: string;
  path: string;
  timestamp: string;
  nonce: string;
  body: string;
  signature: string;
}

export function computeSignature(method: string, path: string, timestamp: string, bodyHash: string): string {
  const payload = `${method}\n${path}\n${timestamp}\n${bodyHash}`;
  return hmacSha256(env.HMAC_CLIENT_KEY, payload);
}

export async function verifyHmac(redis: Redis, params: HmacParams): Promise<void> {
  const { method, path, timestamp, nonce, body, signature } = params;

  // 1. Check timestamp drift
  const now = Math.floor(Date.now() / 1000);
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts) || Math.abs(now - ts) > HMAC_TIMESTAMP_DRIFT_SECONDS) {
    throw new InvalidSignatureError();
  }

  // 2. Check nonce not reused
  const nonceKey = `${REDIS_PREFIXES.HMAC_NONCE}:${nonce}`;
  const wasSet = await redis.set(nonceKey, '1', 'EX', HMAC_NONCE_TTL_SECONDS, 'NX');
  if (!wasSet) {
    throw new InvalidSignatureError();
  }

  // 3. Recompute and compare
  const bodyHash = sha256(body || '');
  const expected = computeSignature(method, path, timestamp, bodyHash);

  if (signature !== expected) {
    throw new InvalidSignatureError();
  }
}
