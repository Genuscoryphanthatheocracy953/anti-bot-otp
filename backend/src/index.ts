import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import { env } from './config/env.js';
import { postgresPlugin } from './plugins/postgres.js';
import { redisPlugin, getRedis } from './plugins/redis.js';
import { jwtPlugin } from './plugins/jwt.js';
import { extractRequestContext } from './middleware/request-context.js';
import { createHmacVerifyHook } from './middleware/hmac-verify.js';
import { authRoutes } from './routes/auth.routes.js';
import { challengeRoutes } from './routes/challenge.routes.js';
import { deviceRoutes } from './routes/device.routes.js';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: string;
  }
}

async function main() {
  const app = Fastify({
    logger: {
      level: env.DEV_MODE ? 'info' : 'warn',
      transport: env.DEV_MODE ? { target: 'pino-pretty' } : undefined,
    },
    trustProxy: true,
  });

  // Custom JSON parser that preserves raw body for HMAC verification
  app.addContentTypeParser('application/json', { parseAs: 'string' }, (req, body, done) => {
    const rawBody = body as string;
    try {
      const parsed = JSON.parse(rawBody);
      // Attach raw body to request for HMAC verification
      (req as any).rawBody = rawBody;
      done(null, parsed);
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  // Error handler — MUST be set before hooks/routes in Fastify 5
  app.setErrorHandler((error, _request, reply) => {
    const err = error as any;

    // AppError and subclasses
    if (err.statusCode && err.code && typeof err.toJSON === 'function') {
      if (env.DEV_MODE) app.log.warn({ errCode: err.code, errMsg: err.message, url: _request.url }, 'AppError');
      if (err.retryAfter !== undefined) {
        reply.header('Retry-After', err.retryAfter.toString());
      }
      return reply.status(err.statusCode).send(err.toJSON());
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return reply.status(401).send({
        success: false,
        error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' },
      });
    }

    app.log.error(error);
    return reply.status(500).send({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
  });

  // CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
  });

  // Cookies
  await app.register(cookie);

  // Plugins
  await app.register(postgresPlugin);
  await app.register(redisPlugin);
  await app.register(jwtPlugin);

  // Global hooks: extract request context
  app.addHook('preHandler', async (request) => {
    request.ctx = extractRequestContext(request);
  });

  // HMAC verification on all /v1/ routes (except health)
  app.addHook('preHandler', async (request, reply) => {
    if (request.url === '/health' || !request.url.startsWith('/v1/')) {
      return;
    }
    const hmacVerify = createHmacVerifyHook(getRedis());
    await hmacVerify(request, reply);
  });

  // Health check
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }));

  // Routes
  await app.register(authRoutes);
  await app.register(challengeRoutes);
  await app.register(deviceRoutes);

  // Start
  await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`Server listening on ${env.HOST}:${env.PORT}`);
}

main().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
