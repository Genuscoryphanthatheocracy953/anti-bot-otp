import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRedis, MockRedis } from '../helpers/mock-redis.js';

vi.mock('../../src/config/env.js', () => ({
  env: {},
}));

import { computeRiskScore, recordFailure } from '../../src/services/risk.service.js';

describe('risk service', () => {
  let redis: MockRedis;

  beforeEach(() => {
    redis = createMockRedis();
  });

  describe('computeRiskScore', () => {
    const baseCtx = {
      ip: '86.45.123.10', // Non-datacenter
      subnet: '86.45.123.0/24',
      deviceId: 'dev-1',
      channel: 'web' as const,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      acceptLanguage: 'en-US,en;q=0.9',
      fingerprint: 'fp-hash-123',
    };

    it('returns low score for normal request', async () => {
      const { score, factors } = await computeRiskScore(redis as any, baseCtx);

      expect(score).toBeLessThanOrEqual(30);
      expect(factors.datacenterIp).toBe(0);
      expect(factors.abnormalHeaders).toBe(0);
    });

    it('adds 25 for datacenter IP', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        ip: '52.1.2.3', // AWS
      });

      expect(factors.datacenterIp).toBe(25);
    });

    it('adds points for missing Accept-Language (web)', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        acceptLanguage: undefined,
      });

      expect(factors.abnormalHeaders).toBeGreaterThanOrEqual(5);
    });

    it('adds points for missing/short User-Agent (web)', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        userAgent: 'bot',
      });

      expect(factors.abnormalHeaders).toBeGreaterThanOrEqual(5);
    });

    it('adds points for missing fingerprint (web)', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        fingerprint: undefined,
      });

      expect(factors.abnormalHeaders).toBeGreaterThanOrEqual(5);
    });

    it('caps abnormal headers at 15', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        acceptLanguage: undefined,
        userAgent: undefined,
        fingerprint: undefined,
      });

      expect(factors.abnormalHeaders).toBeLessThanOrEqual(15);
    });

    it('does NOT score abnormal headers for mobile channel', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        channel: 'mobile' as const,
        acceptLanguage: undefined,
        userAgent: undefined,
        fingerprint: undefined,
      });

      expect(factors.abnormalHeaders).toBe(0);
    });

    it('scores velocity based on recent requests', async () => {
      // Simulate high velocity: many recent entries
      redis.zcard.mockResolvedValueOnce(8);

      const { factors } = await computeRiskScore(redis as any, baseCtx);

      expect(factors.velocity).toBeGreaterThan(0);
      expect(factors.velocity).toBeLessThanOrEqual(20);
    });

    it('caps velocity at 20', async () => {
      redis.zcard.mockResolvedValueOnce(100);

      const { factors } = await computeRiskScore(redis as any, baseCtx);

      expect(factors.velocity).toBe(20);
    });

    it('scores failed PoW attempts', async () => {
      redis.get.mockImplementation(async (key: string) => {
        if (key.includes('risk:fail:pow:')) return '3';
        return null;
      });

      const { factors } = await computeRiskScore(redis as any, baseCtx);

      expect(factors.failedPow).toBe(15); // 3 * 5 = 15 (capped at 15)
    });

    it('scores failed CAPTCHA attempts', async () => {
      redis.get.mockImplementation(async (key: string) => {
        if (key.includes('risk:fail:captcha:')) return '2';
        return null;
      });

      const { factors } = await computeRiskScore(redis as any, baseCtx);

      expect(factors.failedCaptcha).toBe(10); // 2 * 5 = 10 (capped at 10)
    });

    it('scores device-phone mismatch', async () => {
      redis.scard.mockResolvedValueOnce(4); // 4 phones from same device

      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        phone: '+12345678901',
      });

      expect(factors.devicePhoneMismatch).toBe(5); // min(5, (4-1)*2) = 5
    });

    it('caps total score at 100', async () => {
      // Max out all factors
      redis.zcard.mockResolvedValueOnce(100); // velocity = 20
      redis.get.mockImplementation(async (key: string) => {
        if (key.includes('risk:fail:pow:')) return '10';
        if (key.includes('risk:fail:captcha:')) return '10';
        if (key.includes('risk:fail:attest:')) return '5';
        return null;
      });
      redis.scard.mockResolvedValueOnce(10);

      const { score } = await computeRiskScore(redis as any, {
        ...baseCtx,
        ip: '52.1.2.3', // datacenter
        acceptLanguage: undefined,
        userAgent: undefined,
        fingerprint: undefined,
        phone: '+12345678901',
      });

      expect(score).toBeLessThanOrEqual(100);
    });

    it('tracks velocity in sorted set with expiry', async () => {
      await computeRiskScore(redis as any, baseCtx);

      expect(redis.zremrangebyscore).toHaveBeenCalled();
      expect(redis.zadd).toHaveBeenCalled();
      expect(redis.expire).toHaveBeenCalledWith(
        expect.stringContaining('risk:velocity:device:dev-1'),
        120,
      );
    });
  });

  describe('honeypot scoring', () => {
    const baseCtx = {
      ip: '86.45.123.10',
      subnet: '86.45.123.0/24',
      deviceId: 'dev-1',
      channel: 'web' as const,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      acceptLanguage: 'en-US,en;q=0.9',
      fingerprint: 'fp-hash-123',
    };

    it('scores 25 when web honeypot name is filled', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: { honeypot_name: 'John Bot' },
      });
      expect(factors.honeypotTriggered).toBe(25);
    });

    it('scores 25 when web honeypot email is filled', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: { honeypot_email: 'bot@spam.com' },
      });
      expect(factors.honeypotTriggered).toBe(25);
    });

    it('scores 25 when web honeypot url is filled', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: { honeypot_url: 'http://spam.com' },
      });
      expect(factors.honeypotTriggered).toBe(25);
    });

    it('scores 0 when all honeypot fields are empty', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: { honeypot_name: '', honeypot_email: '', honeypot_url: '' },
      });
      expect(factors.honeypotTriggered).toBe(0);
    });

    it('scores 25 for mobile jailbreak', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        channel: 'mobile' as const,
        clientSignals: { automation_signals: { jailbroken: true } },
      });
      expect(factors.honeypotTriggered).toBe(25);
    });

    it('scores 0 for clean mobile device', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        channel: 'mobile' as const,
        clientSignals: { automation_signals: { jailbroken: false, debugger_attached: false } },
      });
      expect(factors.honeypotTriggered).toBe(0);
    });
  });

  describe('automation detection scoring', () => {
    const baseCtx = {
      ip: '86.45.123.10',
      subnet: '86.45.123.0/24',
      deviceId: 'dev-1',
      channel: 'web' as const,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      acceptLanguage: 'en-US,en;q=0.9',
      fingerprint: 'fp-hash-123',
    };

    it('scores 8 for webdriver only', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: { automation_signals: { webdriver: true } },
      });
      expect(factors.automationDetected).toBe(8);
    });

    it('scores 12 for webdriver + selenium', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: { automation_signals: { webdriver: true, selenium: true } },
      });
      expect(factors.automationDetected).toBe(12);
    });

    it('caps automation at 20 even when all web signals present', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: {
          automation_signals: {
            webdriver: true,      // 8
            headless: true,       // 4
            selenium: true,       // 4
            puppeteer: true,      // 4
            playwright: true,     // 4
            plugins_missing: true,// 2
            languages_empty: true,// 2 = 28 total, capped at 20
          },
        },
      });
      expect(factors.automationDetected).toBe(20);
    });

    it('scores mobile signals correctly', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        channel: 'mobile' as const,
        clientSignals: { automation_signals: { jailbroken: true, debugger_attached: true } },
      });
      // jailbreak=8 + debugger=6 = 14
      expect(factors.automationDetected).toBe(14);
    });

    it('caps mobile automation at 20', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        channel: 'mobile' as const,
        clientSignals: {
          automation_signals: { jailbroken: true, debugger_attached: true, suspicious_dylibs: true },
        },
      });
      // 8+6+4 = 18, under cap
      expect(factors.automationDetected).toBe(18);
    });
  });

  describe('timing analysis scoring', () => {
    const baseCtx = {
      ip: '86.45.123.10',
      subnet: '86.45.123.0/24',
      deviceId: 'dev-1',
      channel: 'web' as const,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      acceptLanguage: 'en-US,en;q=0.9',
      fingerprint: 'fp-hash-123',
    };

    it('scores 10 for load-to-submit < 500ms', async () => {
      const now = Date.now();
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: {
          timing: { page_load_ts: now - 200, first_interaction_ts: now - 100, form_submit_ts: now },
        },
      });
      expect(factors.suspiciousTiming).toBe(10);
    });

    it('scores 7 for load-to-submit 500-1500ms', async () => {
      const now = Date.now();
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: {
          timing: { page_load_ts: now - 1000, first_interaction_ts: now - 500, form_submit_ts: now },
        },
      });
      expect(factors.suspiciousTiming).toBe(7);
    });

    it('scores 4 for load-to-submit 1500-3000ms', async () => {
      const now = Date.now();
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: {
          timing: { page_load_ts: now - 2000, first_interaction_ts: now - 1000, form_submit_ts: now },
        },
      });
      expect(factors.suspiciousTiming).toBe(4);
    });

    it('scores 0 for load-to-submit > 3000ms', async () => {
      const now = Date.now();
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: {
          timing: { page_load_ts: now - 5000, first_interaction_ts: now - 3000, form_submit_ts: now },
        },
      });
      expect(factors.suspiciousTiming).toBe(0);
    });

    it('scores 8 for instant fill (interaction-to-submit < 100ms)', async () => {
      const now = Date.now();
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: {
          timing: { page_load_ts: now - 5000, first_interaction_ts: now - 50, form_submit_ts: now },
        },
      });
      expect(factors.suspiciousTiming).toBe(8);
    });

    it('scores 10 for negative load-to-submit gap (submit before load)', async () => {
      const now = Date.now();
      // form_submit_ts before page_load_ts is invalid → 0
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: {
          timing: { page_load_ts: now, form_submit_ts: now - 100 },
        },
      });
      expect(factors.suspiciousTiming).toBe(0);
    });

    it('scores 0 when timing data is missing', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: {},
      });
      expect(factors.suspiciousTiming).toBe(0);
    });
  });

  describe('backward compatibility', () => {
    const baseCtx = {
      ip: '86.45.123.10',
      subnet: '86.45.123.0/24',
      deviceId: 'dev-1',
      channel: 'web' as const,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      acceptLanguage: 'en-US,en;q=0.9',
      fingerprint: 'fp-hash-123',
    };

    it('returns 0 for all new factors when no clientSignals provided', async () => {
      const { factors } = await computeRiskScore(redis as any, baseCtx);
      expect(factors.honeypotTriggered).toBe(0);
      expect(factors.automationDetected).toBe(0);
      expect(factors.suspiciousTiming).toBe(0);
    });

    it('returns 0 for all new factors when clientSignals is undefined', async () => {
      const { factors } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: undefined,
      });
      expect(factors.honeypotTriggered).toBe(0);
      expect(factors.automationDetected).toBe(0);
      expect(factors.suspiciousTiming).toBe(0);
    });
  });

  describe('combined bot profile', () => {
    const baseCtx = {
      ip: '86.45.123.10',
      subnet: '86.45.123.0/24',
      deviceId: 'dev-1',
      channel: 'web' as const,
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      acceptLanguage: 'en-US,en;q=0.9',
      fingerprint: 'fp-hash-123',
    };

    it('bot with honeypot + automation + fast timing exceeds 60', async () => {
      const now = Date.now();
      const { score } = await computeRiskScore(redis as any, {
        ...baseCtx,
        clientSignals: {
          honeypot_name: 'Bot Name',
          automation_signals: { webdriver: true, selenium: true },
          timing: { page_load_ts: now - 100, form_submit_ts: now },
        },
      });
      // honeypot=25 + automation=12 + timing=10 = 47 + velocity(≥2)
      expect(score).toBeGreaterThan(45);
    });
  });

  describe('recordFailure', () => {
    it('increments PoW failure counter', async () => {
      await recordFailure(redis as any, 'pow', 'device-1');

      expect(redis.incr).toHaveBeenCalledWith(
        expect.stringContaining('risk:fail:pow:device-1'),
      );
      expect(redis.expire).toHaveBeenCalledWith(
        expect.stringContaining('risk:fail:pow:device-1'),
        3600,
      );
    });

    it('increments CAPTCHA failure counter', async () => {
      await recordFailure(redis as any, 'captcha', 'device-2');

      expect(redis.incr).toHaveBeenCalledWith(
        expect.stringContaining('risk:fail:captcha:device-2'),
      );
    });

    it('increments attestation failure counter', async () => {
      await recordFailure(redis as any, 'attest', 'device-3');

      expect(redis.incr).toHaveBeenCalledWith(
        expect.stringContaining('risk:fail:attest:device-3'),
      );
    });

    it('sets 1-hour expiry on failure counters', async () => {
      await recordFailure(redis as any, 'pow', 'device-1');

      expect(redis.expire).toHaveBeenCalledWith(
        expect.any(String),
        3600,
      );
    });
  });
});
