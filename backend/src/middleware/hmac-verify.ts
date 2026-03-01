import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyHmac } from '../services/hmac.service.js';
import { InvalidSignatureError } from '../utils/errors.js';
import Redis from 'ioredis';

export function createHmacVerifyHook(redis: Redis) {
  return async function hmacVerifyHook(request: FastifyRequest, reply: FastifyReply) {
    const signature = request.headers['x-signature'] as string;
    const timestamp = request.headers['x-timestamp'] as string;
    const nonce = request.headers['x-nonce'] as string;

    if (!signature || !timestamp || !nonce) {
      throw new InvalidSignatureError();
    }

    const rawBody = (request as any).rawBody || '';

    await verifyHmac(redis, {
      method: request.method,
      path: request.url.split('?')[0],
      timestamp,
      nonce,
      body: rawBody,
      signature,
    });
  };
}
