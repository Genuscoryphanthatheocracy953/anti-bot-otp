import { signRequest } from './hmac';
import { getOrCreateDeviceId, getAccessToken } from './storage';
import { hashFingerprint, collectFingerprint } from './fingerprint';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface ApiError {
  code: string;
  message: string;
  retry_after?: number;
}

export class ApiRequestError extends Error {
  constructor(
    public status: number,
    public error: ApiError,
  ) {
    super(error.message);
  }
}

async function apiFetch<T>(path: string, options: {
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
} = { method: 'GET' }): Promise<T> {
  const bodyStr = options.body ? JSON.stringify(options.body) : '';

  // HMAC signing
  const { signature, timestamp, nonce } = await signRequest(options.method, path, bodyStr);

  // Fingerprint
  let fpHash = '';
  if (typeof window !== 'undefined') {
    try {
      const fp = collectFingerprint();
      fpHash = await hashFingerprint(fp);
    } catch { /* SSR */ }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-Id': getOrCreateDeviceId(),
    'X-Channel': 'web',
    'X-Signature': signature,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    ...(fpHash && { 'X-Fingerprint': fpHash }),
    ...(options.headers || {}),
  };

  const accessToken = getAccessToken();
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method,
    headers,
    body: bodyStr || undefined,
    credentials: 'include',
  });

  const json = await response.json();

  if (!response.ok || !json.success) {
    // Handle both custom format { error: { code, message } } and Fastify default { code, message }
    const apiErr: ApiError = json.error && typeof json.error === 'object'
      ? json.error
      : { code: json.code || 'UNKNOWN', message: json.message || 'Unknown error' };
    throw new ApiRequestError(response.status, apiErr);
  }

  return json.data as T;
}

// --- API Methods ---

export interface PreflightResponse {
  token: string;
  session_id: string;
  risk_score: number;
  expires_at: number;
  pow_challenge?: { nonce: string; difficulty: number; challenge_id: string };
  requires_pow?: boolean;
  requires_captcha?: boolean;
}

export interface OtpSendResponse {
  challenge_id: string;
  expires_at: number;
  purpose: string;
}

export interface OtpVerifyResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
}

export interface SessionMeResponse {
  phone: string;
  device_id: string;
  channel: string;
  issued_at: number;
  expires_at: number;
}

export async function preflight(deviceId: string, fingerprint?: Record<string, string>, clientSignals?: object): Promise<PreflightResponse> {
  return apiFetch<PreflightResponse>('/v1/auth/preflight', {
    method: 'POST',
    body: { channel: 'web', device_id: deviceId, fingerprint, ...(clientSignals && { client_signals: clientSignals }) },
  });
}

export async function sendOtp(
  phone: string,
  purpose: string,
  preflightToken: string,
  opts?: { pow_solution?: { nonce: string; solution: string; challenge_id: string }; captcha_token?: string },
): Promise<OtpSendResponse> {
  return apiFetch<OtpSendResponse>('/v1/auth/otp/send', {
    method: 'POST',
    body: { phone, purpose, ...opts },
    headers: { 'X-Preflight-Token': preflightToken },
  });
}

export async function verifyOtp(phone: string, code: string, challengeId: string, deviceId: string): Promise<OtpVerifyResponse> {
  return apiFetch<OtpVerifyResponse>('/v1/auth/otp/verify', {
    method: 'POST',
    body: { phone, code, challenge_id: challengeId, device_id: deviceId },
  });
}

export async function getSession(): Promise<SessionMeResponse> {
  return apiFetch<SessionMeResponse>('/v1/auth/session/me', { method: 'GET' });
}
