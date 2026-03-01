import Redis from 'ioredis';
import { env } from '../config/env.js';
import { REDIS_PREFIXES } from '../config/constants.js';
import { randomBytes, randomUUID, sha256 } from '../utils/crypto.js';
import type { PowChallenge } from '../types/challenge.js';

export async function issueChallenge(
  redis: Redis,
  deviceId: string,
  difficulty?: number,
): Promise<PowChallenge> {
  const challenge: PowChallenge = {
    nonce: randomBytes(16),
    difficulty: difficulty ?? env.POW_DIFFICULTY,
    challenge_id: randomUUID(),
    created_at: Date.now(),
    device_id: deviceId,
  };

  const key = `${REDIS_PREFIXES.POW_CHALLENGE}:${challenge.challenge_id}`;
  await redis.set(key, JSON.stringify(challenge), 'EX', 300);

  return challenge;
}

export async function verifySolution(
  redis: Redis,
  params: { nonce: string; solution: string; challenge_id: string },
): Promise<boolean> {
  const key = `${REDIS_PREFIXES.POW_CHALLENGE}:${params.challenge_id}`;
  const raw = await redis.get(key);

  if (!raw) {
    return false; // Challenge expired or doesn't exist
  }

  const challenge: PowChallenge = JSON.parse(raw);

  if (challenge.nonce !== params.nonce) {
    return false;
  }

  // Verify SHA256(nonce + solution) has N leading zero bits
  const hash = sha256(params.nonce + params.solution);
  const valid = hasLeadingZeroBits(hash, challenge.difficulty);

  if (valid) {
    // Consume the challenge (one-time use)
    await redis.del(key);
  }

  return valid;
}

function hasLeadingZeroBits(hexHash: string, requiredBits: number): boolean {
  // Each hex char = 4 bits
  const fullHexChars = Math.floor(requiredBits / 4);
  const remainingBits = requiredBits % 4;

  // Check full hex characters are '0'
  for (let i = 0; i < fullHexChars; i++) {
    if (hexHash[i] !== '0') return false;
  }

  // Check remaining bits
  if (remainingBits > 0 && fullHexChars < hexHash.length) {
    const nibble = parseInt(hexHash[fullHexChars], 16);
    const mask = (0xf << (4 - remainingBits)) & 0xf;
    if ((nibble & mask) !== 0) return false;
  }

  return true;
}
