export interface PreflightPayload {
  jti: string;
  session_id: string;
  device_id: string;
  ip_hash: string;
  channel: 'web' | 'mobile';
  risk_score: number;
  iat: number;
  exp: number;
}

export interface OtpRecord {
  hash: string;
  challenge_id: string;
  device_id: string;
  phone: string;
  purpose: string;
  channel: 'web' | 'mobile';
  attempts: number;
  max_attempts: number;
  risk_score: number;
  created_at: number;
  expires_at: number;
}

export interface SessionPayload {
  jti: string;
  sub: string; // phone
  device_id: string;
  channel: string;
  iat: number;
  exp: number;
}

export interface PreflightRequest {
  channel: 'web' | 'mobile';
  device_id: string;
  fingerprint?: Record<string, string>;
  attestation_token?: string;
  client_signals?: import('./risk.js').ClientSignals;
}

export interface OtpSendRequest {
  phone: string;
  purpose: 'login' | 'signup';
  pow_solution?: { nonce: string; solution: string };
  captcha_token?: string;
}

export interface OtpVerifyRequest {
  phone: string;
  code: string;
  challenge_id: string;
  device_id: string;
}
