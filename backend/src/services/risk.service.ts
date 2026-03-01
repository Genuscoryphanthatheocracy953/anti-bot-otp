import Redis from 'ioredis';
import { REDIS_PREFIXES, TIMING_THRESHOLDS, RISK_WEIGHTS } from '../config/constants.js';
import { isDatacenterIp } from '../utils/ip.js';
import type { RiskContext, RiskFactors } from '../types/risk.js';

export async function computeRiskScore(redis: Redis, ctx: RiskContext): Promise<{ score: number; factors: RiskFactors }> {
  const factors: RiskFactors = {
    velocity: 0,
    datacenterIp: 0,
    abnormalHeaders: 0,
    failedPow: 0,
    failedCaptcha: 0,
    failedAttestation: 0,
    devicePhoneMismatch: 0,
    honeypotTriggered: 0,
    automationDetected: 0,
    suspiciousTiming: 0,
  };

  // 1. Request velocity (0-20)
  const velocityKey = `${REDIS_PREFIXES.RISK_VELOCITY}:device:${ctx.deviceId}`;
  const now = Date.now();
  const oneMinAgo = now - 60_000;
  await redis.zremrangebyscore(velocityKey, 0, oneMinAgo);
  await redis.zadd(velocityKey, now.toString(), `${now}:${Math.random()}`);
  await redis.expire(velocityKey, 120);
  const recentCount = await redis.zcard(velocityKey);
  factors.velocity = Math.min(20, Math.floor(recentCount * 2));

  // 2. Datacenter IP (0-25)
  if (isDatacenterIp(ctx.ip)) {
    factors.datacenterIp = 25;
  }

  // 3. Abnormal headers — web only (0-15)
  if (ctx.channel === 'web') {
    let headerScore = 0;
    if (!ctx.acceptLanguage) headerScore += 5;
    if (!ctx.userAgent || ctx.userAgent.length < 20) headerScore += 5;
    if (!ctx.fingerprint) headerScore += 5;
    factors.abnormalHeaders = Math.min(15, headerScore);
  }

  // 4. Failed PoW attempts (0-15)
  const powFailKey = `${REDIS_PREFIXES.RISK_FAIL}:pow:${ctx.deviceId}`;
  const powFails = parseInt(await redis.get(powFailKey) || '0', 10);
  factors.failedPow = Math.min(15, powFails * 5);

  // 5. Failed CAPTCHA (0-10)
  const captchaFailKey = `${REDIS_PREFIXES.RISK_FAIL}:captcha:${ctx.deviceId}`;
  const captchaFails = parseInt(await redis.get(captchaFailKey) || '0', 10);
  factors.failedCaptcha = Math.min(10, captchaFails * 5);

  // 6. Failed attestation (0-10)
  const attestFailKey = `${REDIS_PREFIXES.RISK_FAIL}:attest:${ctx.deviceId}`;
  const attestFails = parseInt(await redis.get(attestFailKey) || '0', 10);
  factors.failedAttestation = Math.min(10, attestFails * 10);

  // 7. Device/phone mismatch frequency (0-5)
  if (ctx.phone) {
    const devicePhonesKey = `${REDIS_PREFIXES.DEVICE_PHONES}:${ctx.deviceId}`;
    await redis.sadd(devicePhonesKey, ctx.phone);
    await redis.expire(devicePhonesKey, 86400);
    const phoneCount = await redis.scard(devicePhonesKey);
    factors.devicePhoneMismatch = Math.min(5, Math.max(0, (phoneCount - 1) * 2));
  }

  // 8. Honeypot (0-25)
  const cs = ctx.clientSignals;
  if (cs) {
    if (ctx.channel === 'web') {
      if (cs.honeypot_name || cs.honeypot_email || cs.honeypot_url) {
        factors.honeypotTriggered = RISK_WEIGHTS.HONEYPOT;
      }
    } else {
      // Mobile: jailbreak/root or debugger → honeypot equivalent
      const isRooted = cs.automation_signals?.jailbroken || cs.automation_signals?.rooted;
      if (isRooted || cs.automation_signals?.debugger_attached) {
        factors.honeypotTriggered = RISK_WEIGHTS.HONEYPOT;
      }
    }

    // 9. Automation detection (0-20, capped)
    const as = cs.automation_signals;
    if (as) {
      let autoScore = 0;
      if (ctx.channel === 'web') {
        if (as.webdriver) autoScore += RISK_WEIGHTS.WEBDRIVER;
        if (as.headless) autoScore += RISK_WEIGHTS.HEADLESS;
        if (as.selenium) autoScore += RISK_WEIGHTS.SELENIUM;
        if (as.puppeteer) autoScore += RISK_WEIGHTS.PUPPETEER;
        if (as.playwright) autoScore += RISK_WEIGHTS.PLAYWRIGHT;
        if (as.plugins_missing) autoScore += RISK_WEIGHTS.PLUGINS_MISSING;
        if (as.languages_empty) autoScore += RISK_WEIGHTS.LANGUAGES_EMPTY;
      } else {
        // iOS signals
        if (as.jailbroken) autoScore += RISK_WEIGHTS.JAILBREAK;
        if (as.suspicious_dylibs) autoScore += RISK_WEIGHTS.DYLIBS;
        // Android signals (aliased fields)
        if (as.rooted) autoScore += RISK_WEIGHTS.JAILBREAK;
        if (as.suspicious_libs) autoScore += RISK_WEIGHTS.DYLIBS;
        // Common mobile signals
        if (as.debugger_attached) autoScore += RISK_WEIGHTS.DEBUGGER;
        // Android-specific extended signals
        if (as.emulator) autoScore += RISK_WEIGHTS.EMULATOR;
        if (as.ui_automation) autoScore += RISK_WEIGHTS.UI_AUTOMATION;
        if (as.hooking_framework) autoScore += RISK_WEIGHTS.HOOKING_FRAMEWORK;
        if (as.screen_reader_abuse) autoScore += RISK_WEIGHTS.SCREEN_READER_ABUSE;
        if (as.overlay_detected) autoScore += RISK_WEIGHTS.OVERLAY_DETECTED;
      }
      factors.automationDetected = Math.min(RISK_WEIGHTS.AUTOMATION_CAP, autoScore);
    }

    // 10. Timing analysis (0-10)
    const timing = cs.timing;
    if (timing) {
      const now = Date.now();
      const { page_load_ts, first_interaction_ts, form_submit_ts } = timing;

      // Validate: all positive, ordered, recent, not future
      const isValid =
        page_load_ts > 0 &&
        form_submit_ts > 0 &&
        form_submit_ts >= page_load_ts &&
        (now - page_load_ts) <= TIMING_THRESHOLDS.MAX_AGE_MS &&
        page_load_ts <= (now + TIMING_THRESHOLDS.CLOCK_SKEW_MS) &&
        form_submit_ts <= (now + TIMING_THRESHOLDS.CLOCK_SKEW_MS);

      if (isValid) {
        const loadToSubmit = form_submit_ts - page_load_ts;
        if (loadToSubmit < TIMING_THRESHOLDS.CERTAIN_BOT_MS) {
          factors.suspiciousTiming = RISK_WEIGHTS.TIMING_CERTAIN_BOT;
        } else if (loadToSubmit < TIMING_THRESHOLDS.VERY_LIKELY_MS) {
          factors.suspiciousTiming = RISK_WEIGHTS.TIMING_VERY_LIKELY;
        } else if (loadToSubmit < TIMING_THRESHOLDS.MILD_MS) {
          factors.suspiciousTiming = RISK_WEIGHTS.TIMING_MILD;
        }

        // Interaction-to-submit check (additive if worse)
        if (first_interaction_ts && first_interaction_ts > 0 && first_interaction_ts <= form_submit_ts) {
          const interactionToSubmit = form_submit_ts - first_interaction_ts;
          if (interactionToSubmit < TIMING_THRESHOLDS.INSTANT_FILL_MS) {
            factors.suspiciousTiming = Math.max(factors.suspiciousTiming, RISK_WEIGHTS.TIMING_INSTANT_FILL);
          }
        }
      }
      // Invalid/missing timing → 0 (no penalty)
    }
  }

  const score = Object.values(factors).reduce((sum, v) => sum + v, 0);
  return { score: Math.min(100, score), factors };
}

export async function recordFailure(redis: Redis, type: 'pow' | 'captcha' | 'attest', deviceId: string): Promise<void> {
  const key = `${REDIS_PREFIXES.RISK_FAIL}:${type}:${deviceId}`;
  await redis.incr(key);
  await redis.expire(key, 3600);
}
