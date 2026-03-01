export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public retryAfter?: number,
  ) {
    super(message);
    this.name = 'AppError';
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        ...(this.retryAfter !== undefined && { retry_after: this.retryAfter }),
      },
    };
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter: number) {
    super(429, 'RATE_LIMITED', 'Too many requests', retryAfter);
  }
}

export class PreflightRequiredError extends AppError {
  constructor() {
    super(401, 'PREFLIGHT_REQUIRED', 'Missing or invalid preflight token');
  }
}

export class InvalidSignatureError extends AppError {
  constructor() {
    super(401, 'INVALID_SIGNATURE', 'Missing or invalid request signature');
  }
}

export class RiskBlockedError extends AppError {
  constructor() {
    super(403, 'RISK_BLOCKED', 'Request blocked due to high risk score');
  }
}

export class OtpExpiredError extends AppError {
  constructor() {
    super(410, 'OTP_EXPIRED', 'OTP has expired');
  }
}

export class OtpExhaustedError extends AppError {
  constructor() {
    super(429, 'OTP_EXHAUSTED', 'Maximum verification attempts exceeded');
  }
}

export class AttestationRequiredError extends AppError {
  constructor() {
    super(401, 'ATTESTATION_REQUIRED', 'Valid attestation token required for mobile channel');
  }
}
