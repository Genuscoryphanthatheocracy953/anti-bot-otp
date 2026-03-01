import Redis from 'ioredis';
import { FastifyRequest, FastifyReply } from 'fastify';
import { REDIS_PREFIXES, RATE_LIMITS } from '../config/constants.js';
import { RateLimitError } from '../utils/errors.js';

type EndpointKey = keyof typeof RATE_LIMITS;

// Lua script for atomic sliding window rate limiting
const SLIDING_WINDOW_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local max = tonumber(ARGV[3])
local member = ARGV[4]

redis.call('ZREMRANGEBYSCORE', key, 0, now - window * 1000)
local count = redis.call('ZCARD', key)

if count >= max then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  if #oldest > 0 then
    local reset_at = tonumber(oldest[2]) + window * 1000
    return {0, math.ceil((reset_at - now) / 1000)}
  end
  return {0, window}
end

redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, window)
return {1, 0}
`;

interface CheckResult {
  allowed: boolean;
  retryAfter: number;
}

async function checkLimit(
  redis: Redis,
  key: string,
  max: number,
  windowSec: number,
): Promise<CheckResult> {
  const now = Date.now();
  const member = `${now}:${Math.random().toString(36).slice(2)}`;

  const result = await redis.eval(
    SLIDING_WINDOW_LUA,
    1,
    key,
    now.toString(),
    windowSec.toString(),
    max.toString(),
    member,
  ) as [number, number];

  return {
    allowed: result[0] === 1,
    retryAfter: result[1],
  };
}

export function createRateLimiter(redis: Redis, endpoint: EndpointKey) {
  const limits = RATE_LIMITS[endpoint];

  return async function rateLimiterHook(request: FastifyRequest, reply: FastifyReply) {
    const ctx = request.ctx;
    let worstRetryAfter = 0;
    let blocked = false;

    const checks: Array<{ dimension: string; value: string; config: { max: number; windowSec: number } }> = [];

    // Build dimension checks from config
    if ('ip' in limits) {
      checks.push({ dimension: 'ip', value: ctx.ip, config: limits.ip });
    }
    if ('subnet' in limits) {
      checks.push({ dimension: 'subnet', value: ctx.subnet, config: limits.subnet });
    }
    if ('device' in limits) {
      checks.push({ dimension: 'device', value: ctx.deviceId, config: limits.device });
    }
    if ('phone' in limits) {
      const body = request.body as Record<string, unknown> | undefined;
      const phone = body?.phone as string;
      if (phone) {
        checks.push({ dimension: 'phone', value: phone, config: (limits as any).phone });
      }
    }
    if ('fingerprint' in limits && ctx.fingerprint) {
      checks.push({ dimension: 'fp', value: ctx.fingerprint, config: (limits as any).fingerprint });
    }

    // Check all dimensions
    for (const { dimension, value, config } of checks) {
      const key = `${REDIS_PREFIXES.RATE_LIMIT}:${endpoint}:${dimension}:${value}`;
      const result = await checkLimit(redis, key, config.max, config.windowSec);
      if (!result.allowed) {
        blocked = true;
        worstRetryAfter = Math.max(worstRetryAfter, result.retryAfter);
      }
    }

    if (blocked) {
      reply.header('Retry-After', worstRetryAfter.toString());
      throw new RateLimitError(worstRetryAfter);
    }
  };
}
