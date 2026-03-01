import Redis from 'ioredis';
import pg from 'pg';
import { env } from '../config/env.js';
import { REDIS_PREFIXES } from '../config/constants.js';
import { generateOtp, hashOtp, verifyOtpHash, randomUUID } from '../utils/crypto.js';
import { OtpRecord } from '../types/auth.js';
import { AppError, OtpExpiredError, OtpExhaustedError } from '../utils/errors.js';

export async function createAndStoreOtp(
  redis: Redis,
  pool: pg.Pool,
  params: {
    phone: string;
    purpose: string;
    deviceId: string;
    channel: 'web' | 'mobile';
    ip: string;
    riskScore: number;
  },
): Promise<{ otp: string; challengeId: string; expiresAt: number }> {
  const { phone, purpose, deviceId, channel, ip, riskScore } = params;

  // Check resend cooldown
  const cooldownKey = `${REDIS_PREFIXES.OTP_COOLDOWN}:${phone}:${purpose}`;
  const cooldownTtl = await redis.ttl(cooldownKey);
  if (cooldownTtl > 0) {
    throw new AppError(429, 'OTP_COOLDOWN', 'Please wait before requesting a new OTP', cooldownTtl);
  }

  // Generate OTP
  const otp = generateOtp(env.OTP_LENGTH);
  const otpHash = await hashOtp(otp);
  const challengeId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + env.OTP_TTL_SECONDS;

  // Store in Redis (only one active per phone+purpose)
  const otpKey = `${REDIS_PREFIXES.OTP}:${phone}:${purpose}`;
  const record: OtpRecord = {
    hash: otpHash,
    challenge_id: challengeId,
    device_id: deviceId,
    phone,
    purpose,
    channel,
    attempts: 0,
    max_attempts: env.OTP_MAX_VERIFY_ATTEMPTS,
    risk_score: riskScore,
    created_at: now,
    expires_at: expiresAt,
  };
  await redis.set(otpKey, JSON.stringify(record), 'EX', env.OTP_TTL_SECONDS);

  // Set resend cooldown
  await redis.set(cooldownKey, '1', 'EX', env.OTP_RESEND_COOLDOWN_SECONDS);

  // Store audit in PostgreSQL
  await pool.query(
    `INSERT INTO otp_requests (phone, purpose, challenge_id, device_id, otp_hash, ip_address, channel, risk_score, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, to_timestamp($9))`,
    [phone, purpose, challengeId, deviceId, otpHash, ip, channel, riskScore, expiresAt],
  );

  return { otp, challengeId, expiresAt };
}

export async function verifyOtp(
  redis: Redis,
  pool: pg.Pool,
  params: {
    phone: string;
    code: string;
    challengeId: string;
    deviceId: string;
    purpose: string;
  },
): Promise<{ verified: boolean; record: OtpRecord }> {
  const { phone, code, challengeId, deviceId, purpose } = params;

  const otpKey = `${REDIS_PREFIXES.OTP}:${phone}:${purpose}`;
  const raw = await redis.get(otpKey);

  if (!raw) {
    throw new OtpExpiredError();
  }

  const record: OtpRecord = JSON.parse(raw);

  // Verify challenge_id binding
  if (record.challenge_id !== challengeId) {
    throw new AppError(400, 'INVALID_CHALLENGE', 'Challenge ID mismatch');
  }

  // Verify device binding
  if (record.device_id !== deviceId) {
    throw new AppError(400, 'DEVICE_MISMATCH', 'Device ID mismatch');
  }

  // Check attempts
  if (record.attempts >= record.max_attempts) {
    await redis.del(otpKey);
    await pool.query(
      `UPDATE otp_requests SET status = 'exhausted' WHERE challenge_id = $1`,
      [challengeId],
    );
    throw new OtpExhaustedError();
  }

  // Increment attempts
  record.attempts += 1;
  const ttl = await redis.ttl(otpKey);
  if (ttl <= 0) {
    throw new OtpExpiredError();
  }
  await redis.set(otpKey, JSON.stringify(record), 'EX', ttl);

  // Verify OTP hash
  const valid = await verifyOtpHash(code, record.hash);

  if (valid) {
    // Invalidate OTP
    await redis.del(otpKey);
    await pool.query(
      `UPDATE otp_requests SET status = 'verified', verified_at = NOW(), attempts = $2 WHERE challenge_id = $1`,
      [challengeId, record.attempts],
    );
  } else {
    await pool.query(
      `UPDATE otp_requests SET attempts = $2 WHERE challenge_id = $1`,
      [challengeId, record.attempts],
    );
  }

  return { verified: valid, record };
}
