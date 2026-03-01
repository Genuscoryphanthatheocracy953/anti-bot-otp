import { FastifyRequest } from 'fastify';
import { extractIp, extractSubnet } from '../utils/ip.js';
import { extractFingerprintFromHeaders } from '../services/fingerprint.service.js';
import type { ClientSignals } from '../types/risk.js';

export interface RequestContext {
  ip: string;
  subnet: string;
  deviceId: string;
  channel: 'web' | 'mobile';
  fingerprint?: string;
  userAgent?: string;
  acceptLanguage?: string;
  clientSignals?: ClientSignals;
}

declare module 'fastify' {
  interface FastifyRequest {
    ctx: RequestContext;
  }
}

export function extractRequestContext(request: FastifyRequest): RequestContext {
  const ip = extractIp(request);
  const subnet = extractSubnet(ip);
  const deviceId = (request.headers['x-device-id'] as string) || 'unknown';
  const channel = ((request.headers['x-channel'] as string) || 'web') as 'web' | 'mobile';
  const fingerprint = extractFingerprintFromHeaders(request.headers);
  const userAgent = request.headers['user-agent'] as string | undefined;
  const acceptLanguage = request.headers['accept-language'] as string | undefined;

  return { ip, subnet, deviceId, channel, fingerprint, userAgent, acceptLanguage };
}
