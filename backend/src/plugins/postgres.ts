import { FastifyInstance } from 'fastify';
import pg from 'pg';
import { env } from '../config/env.js';

declare module 'fastify' {
  interface FastifyInstance {
    pg: pg.Pool;
  }
}

let _pool: pg.Pool | null = null;
export function getPool(): pg.Pool {
  if (!_pool) throw new Error('PostgreSQL not initialized');
  return _pool;
}

export async function postgresPlugin(fastify: FastifyInstance) {
  const pool = new pg.Pool({
    host: env.POSTGRES_HOST,
    port: env.POSTGRES_PORT,
    database: env.POSTGRES_DB,
    user: env.POSTGRES_USER,
    password: env.POSTGRES_PASSWORD,
    max: 20,
  });

  // Test connection
  const client = await pool.connect();
  client.release();
  fastify.log.info('PostgreSQL connected');

  _pool = pool;
  fastify.decorate('pg', pool);

  fastify.addHook('onClose', async () => {
    await pool.end();
  });
}
