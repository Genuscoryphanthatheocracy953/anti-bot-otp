import { FastifyInstance, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    jwtSign: (payload: object, secret: string, options?: jwt.SignOptions) => string;
    jwtVerify: <T = object>(token: string, secret: string) => T;
  }
}

export async function jwtPlugin(fastify: FastifyInstance) {
  fastify.decorate('jwtSign', (payload: object, secret: string, options?: jwt.SignOptions) => {
    return jwt.sign(payload, secret, options);
  });

  fastify.decorate('jwtVerify', <T = object>(token: string, secret: string): T => {
    return jwt.verify(token, secret) as T;
  });
}
