import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRedis, MockRedis } from '../helpers/mock-redis.js';

vi.mock('../../src/config/env.js', () => ({
  env: {
    POW_DIFFICULTY: 4,
  },
}));

import { createRiskGate } from '../../src/middleware/risk-gate.js';
import * as riskService from '../../src/services/risk.service.js';
import * as powService from '../../src/services/pow.service.js';
import * as captchaService from '../../src/services/captcha.service.js';

// Spy on services
vi.spyOn(riskService, 'computeRiskScore');
vi.spyOn(riskService, 'recordFailure');
vi.spyOn(powService, 'verifySolution');
vi.spyOn(captchaService, 'verifyCaptchaToken');

describe('risk gate middleware', () => {
  let redis: MockRedis;
  const baseFactors = {
    velocity: 0,
    datacenterIp: 0,
    abnormalHeaders: 0,
    failedPow: 0,
    failedCaptcha: 0,
    failedAttestation: 0,
    devicePhoneMismatch: 0,
  };

  beforeEach(() => {
    redis = createMockRedis();
    vi.clearAllMocks();
  });

  function makeRequest(body: Record<string, unknown> = {}) {
    return {
      ctx: {
        ip: '192.168.1.1',
        subnet: '192.168.1.0/24',
        deviceId: 'device-1',
        channel: 'web',
        userAgent: 'Mozilla/5.0',
        acceptLanguage: 'en-US',
        fingerprint: 'fp-hash',
      },
      body,
    } as any;
  }

  it('passes when risk score is low (<=30)', async () => {
    vi.mocked(riskService.computeRiskScore).mockResolvedValueOnce({
      score: 15,
      factors: baseFactors,
    });

    const gate = createRiskGate(redis as any);
    await expect(gate(makeRequest(), {} as any)).resolves.toBeUndefined();
  });

  it('blocks when risk score is high (>60)', async () => {
    vi.mocked(riskService.computeRiskScore).mockResolvedValueOnce({
      score: 75,
      factors: { ...baseFactors, datacenterIp: 25, velocity: 20, abnormalHeaders: 15, failedPow: 15 },
    });

    const gate = createRiskGate(redis as any);
    await expect(gate(makeRequest(), {} as any)).rejects.toThrow('Request blocked due to high risk score');
  });

  it('requires PoW+CAPTCHA for mid-range risk (31-60)', async () => {
    vi.mocked(riskService.computeRiskScore).mockResolvedValueOnce({
      score: 45,
      factors: { ...baseFactors, datacenterIp: 25, velocity: 20 },
    });

    const gate = createRiskGate(redis as any);

    // No PoW solution provided
    await expect(gate(makeRequest({ phone: '+12345' }), {} as any)).rejects.toThrow('Proof-of-work solution required');
  });

  it('rejects invalid PoW in mid-range risk', async () => {
    vi.mocked(riskService.computeRiskScore).mockResolvedValueOnce({
      score: 45,
      factors: baseFactors,
    });
    vi.mocked(powService.verifySolution).mockResolvedValueOnce(false);

    const gate = createRiskGate(redis as any);
    const request = makeRequest({
      pow_solution: { nonce: 'n', solution: 's', challenge_id: 'c' },
    });

    await expect(gate(request, {} as any)).rejects.toThrow('Invalid proof-of-work');
    expect(riskService.recordFailure).toHaveBeenCalledWith(redis, 'pow', 'device-1');
  });

  it('requires CAPTCHA after valid PoW in mid-range risk', async () => {
    vi.mocked(riskService.computeRiskScore).mockResolvedValueOnce({
      score: 45,
      factors: baseFactors,
    });
    vi.mocked(powService.verifySolution).mockResolvedValueOnce(true);

    const gate = createRiskGate(redis as any);
    const request = makeRequest({
      pow_solution: { nonce: 'n', solution: 's', challenge_id: 'c' },
      // No captcha_token
    });

    await expect(gate(request, {} as any)).rejects.toThrow('CAPTCHA verification required');
  });

  it('rejects invalid CAPTCHA in mid-range risk', async () => {
    vi.mocked(riskService.computeRiskScore).mockResolvedValueOnce({
      score: 45,
      factors: baseFactors,
    });
    vi.mocked(powService.verifySolution).mockResolvedValueOnce(true);
    vi.mocked(captchaService.verifyCaptchaToken).mockReturnValueOnce(false);

    const gate = createRiskGate(redis as any);
    const request = makeRequest({
      pow_solution: { nonce: 'n', solution: 's', challenge_id: 'c' },
      captcha_token: 'wrong',
    });

    await expect(gate(request, {} as any)).rejects.toThrow('Invalid CAPTCHA');
    expect(riskService.recordFailure).toHaveBeenCalledWith(redis, 'captcha', 'device-1');
  });

  it('passes mid-range risk with valid PoW and CAPTCHA', async () => {
    vi.mocked(riskService.computeRiskScore).mockResolvedValueOnce({
      score: 45,
      factors: baseFactors,
    });
    vi.mocked(powService.verifySolution).mockResolvedValueOnce(true);
    vi.mocked(captchaService.verifyCaptchaToken).mockReturnValueOnce(true);

    const gate = createRiskGate(redis as any);
    const request = makeRequest({
      pow_solution: { nonce: 'n', solution: 's', challenge_id: 'c' },
      captcha_token: 'pass',
    });

    await expect(gate(request, {} as any)).resolves.toBeUndefined();
  });

  it('attaches risk score and factors to request', async () => {
    vi.mocked(riskService.computeRiskScore).mockResolvedValueOnce({
      score: 20,
      factors: { ...baseFactors, velocity: 10, datacenterIp: 10 },
    });

    const gate = createRiskGate(redis as any);
    const request = makeRequest();
    await gate(request, {} as any);

    expect(request.riskScore).toBe(20);
    expect(request.riskFactors).toBeTruthy();
    expect(request.riskFactors.velocity).toBe(10);
  });
});
