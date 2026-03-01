import { FastifyRequest, FastifyReply } from 'fastify';
import Redis from 'ioredis';
import { consumePreflight } from '../services/preflight.service.js';
import { PreflightRequiredError } from '../utils/errors.js';
import type { PreflightPayload } from '../types/auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    preflight: PreflightPayload;
  }
}

export function createPreflightGuard(redis: Redis) {
  return async function preflightGuardHook(request: FastifyRequest, _reply: FastifyReply) {
    const token = request.headers['x-preflight-token'] as string;

    if (!token) {
      throw new PreflightRequiredError();
    }

    try {
      const payload = await consumePreflight(redis, token, request.ctx.ip, request.ctx.deviceId);
      request.preflight = payload;
    } catch {
      throw new PreflightRequiredError();
    }
  };
}
