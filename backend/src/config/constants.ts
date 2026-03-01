export const REDIS_PREFIXES = {
  RATE_LIMIT: 'rl',
  OTP: 'otp',
  OTP_COOLDOWN: 'otp:cooldown',
  PREFLIGHT_JTI: 'preflight:jti',
  POW_CHALLENGE: 'pow',
  HMAC_NONCE: 'hmac:nonce',
  RISK_VELOCITY: 'risk:velocity',
  RISK_FAIL: 'risk:fail',
  DEVICE_PHONES: 'device:phones',
  ATTESTATION: 'attest',
  SESSION_REVOKED: 'session:revoked',
} as const;

export const RATE_LIMITS = {
  preflight: {
    ip: { max: 30, windowSec: 600 },
    subnet: { max: 100, windowSec: 600 },
    device: { max: 20, windowSec: 600 },
  },
  'otp-send': {
    phone: { max: 5, windowSec: 3600 },
    ip: { max: 20, windowSec: 3600 },
    subnet: { max: 50, windowSec: 3600 },
    device: { max: 10, windowSec: 3600 },
    fingerprint: { max: 10, windowSec: 3600 },
  },
  'otp-verify': {
    phone: { max: 15, windowSec: 3600 },
    ip: { max: 30, windowSec: 3600 },
    device: { max: 20, windowSec: 3600 },
  },
} as const;

// Sample datacenter IP ranges (CIDRs) for risk scoring
export const DATACENTER_CIDRS = [
  '10.0.0.0/8',       // Private — for PoC testing
  '100.64.0.0/10',    // Carrier-grade NAT
  '198.51.100.0/24',  // TEST-NET-2
  '203.0.113.0/24',   // TEST-NET-3
  // Real datacenter ranges (samples):
  '134.209.0.0/16',   // DigitalOcean
  '104.16.0.0/12',    // Cloudflare
  '35.192.0.0/11',    // GCP
  '52.0.0.0/11',      // AWS us-east
  '13.64.0.0/11',     // Azure
];

export const RISK_THRESHOLDS = {
  LOW: 30,
  MID: 60,
} as const;

export const TIMING_THRESHOLDS = {
  CERTAIN_BOT_MS: 500,
  VERY_LIKELY_MS: 1500,
  MILD_MS: 3000,
  INSTANT_FILL_MS: 100,
  MAX_AGE_MS: 5 * 60 * 1000, // 5 minutes
  CLOCK_SKEW_MS: 5 * 1000,   // 5 seconds
} as const;

export const RISK_WEIGHTS = {
  // Honeypot
  HONEYPOT: 25,
  // Web automation signals
  WEBDRIVER: 8,
  HEADLESS: 4,
  SELENIUM: 4,
  PUPPETEER: 4,
  PLAYWRIGHT: 4,
  PLUGINS_MISSING: 2,
  LANGUAGES_EMPTY: 2,
  AUTOMATION_CAP: 20,
  // Mobile signals
  JAILBREAK: 8,
  DEBUGGER: 6,
  DYLIBS: 4,
  // Android-specific extended signals
  EMULATOR: 4,
  UI_AUTOMATION: 6,
  HOOKING_FRAMEWORK: 6,
  SCREEN_READER_ABUSE: 4,
  OVERLAY_DETECTED: 3,
  // Timing scores
  TIMING_CERTAIN_BOT: 10,
  TIMING_VERY_LIKELY: 7,
  TIMING_MILD: 4,
  TIMING_INSTANT_FILL: 8,
} as const;

export const HMAC_TIMESTAMP_DRIFT_SECONDS = 30;
export const HMAC_NONCE_TTL_SECONDS = 60;
