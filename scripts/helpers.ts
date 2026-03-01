import crypto from 'node:crypto';

const BASE_URL = process.env.API_URL || 'http://localhost:3000';
const HMAC_KEY = process.env.HMAC_CLIENT_KEY || 'change_me_hmac_client_key_at_least_32_chars_long';

export function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function hmacSign(method: string, path: string, body: string): {
  signature: string;
  timestamp: string;
  nonce: string;
} {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = crypto.randomUUID();
  const bodyHash = sha256(body || '');
  const payload = `${method}\n${path}\n${timestamp}\n${bodyHash}`;
  const signature = crypto.createHmac('sha256', HMAC_KEY).update(payload).digest('hex');
  return { signature, timestamp, nonce };
}

export async function apiCall(
  method: string,
  path: string,
  body?: unknown,
  extraHeaders?: Record<string, string>,
): Promise<{ status: number; data: any; headers: Headers }> {
  const bodyStr = body ? JSON.stringify(body) : '';
  const { signature, timestamp, nonce } = hmacSign(method, path, bodyStr);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Signature': signature,
    'X-Timestamp': timestamp,
    'X-Nonce': nonce,
    'X-Device-Id': `script-${crypto.randomUUID().slice(0, 8)}`,
    'X-Channel': 'web',
    'Accept-Language': 'en-US',
    'User-Agent': 'OTPPoc-TestScript/1.0',
    ...(extraHeaders || {}),
  };

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: bodyStr || undefined,
  });

  const data = await response.json();
  return { status: response.status, data, headers: response.headers };
}

// Colors for terminal output
export const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
export const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
export const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
export const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
