'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  preflight as apiPreflight,
  sendOtp as apiSendOtp,
  verifyOtp as apiVerifyOtp,
  getSession as apiGetSession,
  ApiRequestError,
  type PreflightResponse,
  type SessionMeResponse,
} from '@/lib/api-client';
import { getOrCreateDeviceId, setAccessToken } from '@/lib/storage';
import { collectFingerprint } from '@/lib/fingerprint';
import { solvePow } from '@/lib/pow-solver';
import { detectAutomation } from '@/lib/automation-detect';

type AuthState = 'idle' | 'preflight' | 'solving_pow' | 'otp_sent' | 'verifying' | 'authenticated';

export interface HoneypotState {
  honeypotName: string;
  honeypotEmail: string;
  honeypotUrl: string;
}

export function useAuthFlow() {
  const [state, setState] = useState<AuthState>('idle');
  const [phone, setPhoneRaw] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [preflightData, setPreflightData] = useState<PreflightResponse | null>(null);
  const [session, setSession] = useState<SessionMeResponse | null>(null);

  // Timing tracking
  const pageLoadTs = useRef<number>(0);
  const firstInteractionTs = useRef<number | null>(null);

  useEffect(() => {
    pageLoadTs.current = Date.now();
  }, []);

  // Track first interaction when phone field changes
  const setPhone = useCallback((value: string) => {
    if (!firstInteractionTs.current && value.length > 0) {
      firstInteractionTs.current = Date.now();
    }
    setPhoneRaw(value);
  }, []);

  const startAuth = useCallback(async (honeypot?: HoneypotState) => {
    setError(null);
    setStatusMessage(null);

    try {
      const deviceId = getOrCreateDeviceId();
      const fp = collectFingerprint();

      // Step 1: Preflight — collect client signals
      setState('preflight');
      setStatusMessage('Running preflight check...');
      const automationSignals = detectAutomation();
      const clientSignals = {
        honeypot_name: honeypot?.honeypotName || '',
        honeypot_email: honeypot?.honeypotEmail || '',
        honeypot_url: honeypot?.honeypotUrl || '',
        automation_signals: automationSignals,
        timing: {
          page_load_ts: pageLoadTs.current,
          first_interaction_ts: firstInteractionTs.current ?? undefined,
          form_submit_ts: Date.now(),
        },
      };
      const pf = await apiPreflight(deviceId, fp as unknown as Record<string, string>, clientSignals);
      setPreflightData(pf);
      setStatusMessage(`Preflight passed. Risk score: ${pf.risk_score}`);

      // Step 2: Solve PoW if required
      let powSolution: { nonce: string; solution: string; challenge_id: string } | undefined;
      if (pf.requires_pow && pf.pow_challenge) {
        setState('solving_pow');
        setStatusMessage(`Solving proof-of-work (difficulty: ${pf.pow_challenge.difficulty})...`);
        const solution = await solvePow(pf.pow_challenge.nonce, pf.pow_challenge.difficulty);
        powSolution = {
          nonce: pf.pow_challenge.nonce,
          solution,
          challenge_id: pf.pow_challenge.challenge_id,
        };
        setStatusMessage('PoW solved!');
      }

      // Step 3: Send OTP
      setStatusMessage('Sending OTP...');
      const otpResp = await apiSendOtp(phone, 'login', pf.token, {
        pow_solution: powSolution,
        captcha_token: pf.requires_captcha ? 'pass' : undefined, // stub
      });

      setChallengeId(otpResp.challenge_id);
      setState('otp_sent');
      setStatusMessage('OTP sent! Check Telegram or backend console.');
    } catch (err) {
      setState('idle');
      if (err instanceof ApiRequestError) {
        setError(`${err.error.code}: ${err.error.message}${err.error.retry_after ? ` (retry in ${err.error.retry_after}s)` : ''}`);
      } else {
        setError((err as Error).message);
      }
    }
  }, [phone]);

  const handleVerifyOtp = useCallback(async () => {
    setError(null);

    if (!challengeId) {
      setError('No challenge ID — start the flow again');
      return;
    }

    try {
      setState('verifying');
      setStatusMessage('Verifying OTP...');

      const deviceId = getOrCreateDeviceId();
      const result = await apiVerifyOtp(phone, otpCode, challengeId, deviceId);

      setAccessToken(result.access_token);
      setStatusMessage('OTP verified! Fetching session...');

      const sessionData = await apiGetSession();
      setSession(sessionData);
      setState('authenticated');
      setStatusMessage(null);
    } catch (err) {
      setState('otp_sent');
      if (err instanceof ApiRequestError) {
        setError(`${err.error.code}: ${err.error.message}`);
      } else {
        setError((err as Error).message);
      }
    }
  }, [phone, otpCode, challengeId]);

  const reset = useCallback(() => {
    setState('idle');
    setPhone('');
    setOtpCode('');
    setError(null);
    setStatusMessage(null);
    setChallengeId(null);
    setPreflightData(null);
    setSession(null);
  }, []);

  return {
    state,
    phone,
    setPhone,
    otpCode,
    setOtpCode,
    error,
    statusMessage,
    session,
    startAuth,
    verifyOtp: handleVerifyOtp,
    reset,
  };
}
