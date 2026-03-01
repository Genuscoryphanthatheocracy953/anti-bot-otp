/**
 * Mobile Attestation Stub
 *
 * In production, replace with:
 *   - Android: Play Integrity API
 *   - iOS: App Attest / DeviceCheck
 *
 * This PoC uses a simple P256/ECDSA challenge-response with a client-generated keypair.
 */
import crypto from 'node:crypto';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { REDIS_PREFIXES } from '../config/constants.js';
import { randomBytes, randomUUID } from '../utils/crypto.js';

const ATTESTATION_TTL = 86400; // 24 hours

export async function issueAttestationChallenge(
  redis: Redis,
  deviceId: string,
): Promise<{ challenge: string; challenge_id: string }> {
  const challenge = randomBytes(32);
  const challengeId = randomUUID();

  const key = `${REDIS_PREFIXES.ATTESTATION}:challenge:${challengeId}`;
  await redis.set(key, JSON.stringify({ challenge, device_id: deviceId }), 'EX', 300);

  return { challenge, challenge_id: challengeId };
}

export async function verifyAttestationResponse(
  redis: Redis,
  params: {
    challenge_id: string;
    device_id: string;
    challenge: string;
    signed_response: string;
    public_key: string;
    app_id: string;
  },
): Promise<{ attestation_jwt: string }> {
  // Retrieve challenge
  const key = `${REDIS_PREFIXES.ATTESTATION}:challenge:${params.challenge_id}`;
  const raw = await redis.get(key);
  if (!raw) throw new Error('Challenge expired or not found');

  const stored = JSON.parse(raw);
  if (stored.device_id !== params.device_id) throw new Error('Device mismatch');
  if (stored.challenge !== params.challenge) throw new Error('Challenge mismatch');

  // Verify ECDSA signature (P256/SHA256)
  const verifier = crypto.createVerify('SHA256');
  verifier.update(params.challenge);
  const isValid = verifier.verify(
    { key: params.public_key, format: 'pem', type: 'spki' },
    Buffer.from(params.signed_response, 'base64'),
  );

  if (!isValid) throw new Error('Invalid attestation signature');

  // Consume challenge
  await redis.del(key);

  // Store attestation
  const attestKey = `${REDIS_PREFIXES.ATTESTATION}:${params.device_id}`;
  await redis.set(attestKey, JSON.stringify({
    public_key_hash: crypto.createHash('sha256').update(params.public_key).digest('hex'),
    app_id: params.app_id,
    issued_at: Date.now(),
  }), 'EX', ATTESTATION_TTL);

  // Issue attestation JWT
  const attestation_jwt = jwt.sign(
    {
      device_id: params.device_id,
      app_id: params.app_id,
      type: 'attestation',
    },
    env.ATTESTATION_SECRET,
    { expiresIn: '24h', jwtid: randomUUID() },
  );

  return { attestation_jwt };
}

export function verifyAttestationJwt(token: string): { device_id: string; app_id: string } {
  const payload = jwt.verify(token, env.ATTESTATION_SECRET) as {
    device_id: string;
    app_id: string;
    type: string;
  };
  if (payload.type !== 'attestation') throw new Error('Invalid attestation token type');
  return { device_id: payload.device_id, app_id: payload.app_id };
}
