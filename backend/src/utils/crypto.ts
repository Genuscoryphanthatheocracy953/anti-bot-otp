import crypto from 'node:crypto';
import argon2 from 'argon2';

export function generateOtp(length: number): string {
  const max = Math.pow(10, length);
  const num = crypto.randomInt(0, max);
  return num.toString().padStart(length, '0');
}

export async function hashOtp(otp: string): Promise<string> {
  return argon2.hash(otp, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}

export async function verifyOtpHash(otp: string, hash: string): Promise<boolean> {
  return argon2.verify(hash, otp);
}

export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function hmacSha256(key: string, data: string): string {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

export function randomUUID(): string {
  return crypto.randomUUID();
}

export function randomBytes(size: number): string {
  return crypto.randomBytes(size).toString('hex');
}
