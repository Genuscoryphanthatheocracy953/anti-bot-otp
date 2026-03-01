import { FastifyInstance } from 'fastify';
import Redis from 'ioredis';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    redis: Redis;
  }
}

// Exported singleton so hooks registered before plugin resolution can access it
let _redis: Redis | null = null;
export function getRedis(): Redis {
  if (!_redis) throw new Error('Redis not initialized');
  return _redis;
}

export async function redisPlugin(fastify: FastifyInstance) {
  const redis = new Redis({
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    maxRetriesPerRequest: 3,
  });

  await redis.ping();
  fastify.log.info('Redis connected');

  _redis = redis;
  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
}
