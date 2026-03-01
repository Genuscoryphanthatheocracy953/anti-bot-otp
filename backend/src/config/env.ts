import { z } from 'zod';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env first, then .env.local as override (for personal credentials)
dotenv.config();
dotenv.config({ path: resolve(process.cwd(), '.env.local'), override: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().default(5432),
  POSTGRES_DB: z.string().default('otppoc'),
  POSTGRES_USER: z.string().default('otppoc'),
  POSTGRES_PASSWORD: z.string(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),

  JWT_SECRET: z.string().min(32),
  PREFLIGHT_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ATTESTATION_SECRET: z.string().min(32),
  HMAC_CLIENT_KEY: z.string().min(32),

  TELEGRAM_BOT_TOKEN: z.string().default(''),
  TELEGRAM_CHAT_ID: z.string().default(''),

  DEV_MODE: z.coerce.boolean().default(true),

  OTP_TTL_SECONDS: z.coerce.number().default(180),
  OTP_LENGTH: z.coerce.number().default(6),
  OTP_MAX_VERIFY_ATTEMPTS: z.coerce.number().default(5),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(60),
  OTP_MAX_SENDS_PER_HOUR: z.coerce.number().default(5),

  PREFLIGHT_TTL_SECONDS: z.coerce.number().default(120),
  POW_DIFFICULTY: z.coerce.number().default(4),
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
