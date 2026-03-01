'use client';

import { useState } from 'react';
import { useAuthFlow } from '@/hooks/useAuthFlow';

const colors = {
  brand900: '#0F172A',
  brand800: '#1E293B',
  brand500: '#3B82F6',
  brand400: '#60A5FA',
  brand100: '#DBEAFE',
  surface: '#FFFFFF',
  bg: '#F8FAFC',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  success: '#10B981',
  successBg: '#ECFDF5',
  error: '#EF4444',
  errorBg: '#FEF2F2',
  defenseBg: '#F0F9FF',
  defenseBorder: '#BAE6FD',
  defenseIcon: '#0EA5E9',
};

function StepIndicator({ currentStep }: { currentStep: number }) {
  const steps = ['Phone', 'Verify', 'Done'];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px 32px 8px', gap: 0 }}>
      {steps.map((label, i) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center' }}>
          {i > 0 && (
            <div style={{
              width: 48,
              height: 2,
              backgroundColor: i <= currentStep ? colors.brand500 : colors.border,
              transition: 'background-color 0.3s',
            }} />
          )}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              backgroundColor: i < currentStep ? colors.success : i === currentStep ? colors.brand500 : colors.border,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.3s',
            }}>
              {i < currentStep ? (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : (
                <span style={{ fontSize: 12, fontWeight: 700, color: i === currentStep ? '#fff' : colors.textMuted }}>{i + 1}</span>
              )}
            </div>
            <span style={{
              fontSize: 11,
              fontWeight: i === currentStep ? 600 : 400,
              color: i <= currentStep ? colors.textPrimary : colors.textMuted,
            }}>{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function LoadingDots() {
  return (
    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', padding: 20 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          backgroundColor: colors.brand500,
          animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`,
        }} />
      ))}
    </div>
  );
}

const defenses = [
  { icon: 'M9 12l2 2 4-4', label: 'HMAC Request Signing' },
  { icon: 'M12 8v4l3 3', label: 'Preflight Token (120s TTL)' },
  { icon: 'M3 12h4l3-9 4 18 3-9h4', label: 'Multi-dimensional Rate Limiting' },
  { icon: 'M18 20V10M12 20V4M6 20v-6', label: 'Risk Scoring (0-100)' },
  { icon: 'M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.6-3.6a1 1 0 000-1.4l-1.6-1.6a1 1 0 00-1.4 0z', label: 'Proof-of-Work Challenge' },
  { icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z', label: 'Device Attestation' },
  { icon: 'M12 11c0-1.1-.9-2-2-2s-2 .9-2 2 .9 2 2 2 2-.9 2-2z', label: 'Browser Fingerprinting' },
  { icon: 'M17 11h1a3 3 0 010 6h-1M7 11H6a3 3 0 000 6h1M8 11V7a4 4 0 118 0v4', label: 'OTP Binding (argon2id)' },
  { icon: 'M3 3h18v18H3zM9 9h6v6H9z', label: 'Honeypot Traps' },
  { icon: 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7c-1.274 4.057-5.065 7-9.542 7s-8.268-2.943-9.542-7z', label: 'Automation Detection' },
  { icon: 'M12 8v4l3 3M21 12a9 9 0 11-18 0 9 9 0 0118 0z', label: 'Timing Analysis' },
];

function DefenseCard() {
  return (
    <div style={{
      padding: 24,
      backgroundColor: colors.defenseBg,
      borderRadius: 16,
      border: `1px solid ${colors.defenseBorder}`,
      animation: 'fadeIn 0.3s ease-out',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.defenseIcon} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 700, color: colors.defenseIcon, letterSpacing: 1.2 }}>ACTIVE DEFENSES</span>
      </div>
      {defenses.map(d => (
        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: colors.brand100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={colors.brand500} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={d.icon}/>
            </svg>
          </div>
          <span style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary }}>{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function Home() {
  const {
    state,
    phone,
    setPhone,
    otpCode,
    setOtpCode,
    error,
    statusMessage,
    session,
    startAuth,
    verifyOtp,
    reset,
  } = useAuthFlow();

  // Honeypot state — hidden fields that only bots fill
  const [honeypotName, setHoneypotName] = useState('');
  const [honeypotEmail, setHoneypotEmail] = useState('');
  const [honeypotUrl, setHoneypotUrl] = useState('');

  const currentStep = state === 'idle' || state === 'preflight' || state === 'solving_pow'
    ? 0
    : state === 'authenticated'
    ? 2
    : 1;

  const isLoading = state === 'preflight' || state === 'solving_pow';

  return (
    <div>
      {/* Hero Header */}
      <div style={{
        background: `linear-gradient(135deg, ${colors.brand900}, ${colors.brand800})`,
        borderRadius: '0 0 24px 24px',
        padding: '40px 24px 28px',
        textAlign: 'center',
        marginBottom: 0,
      }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>&#x1f512;</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>OTP Auth PoC</h1>
        <p style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.6)', margin: 0 }}>Layered Anti-Bot Defenses</p>
      </div>

      <div style={{ padding: '0 20px 32px' }}>
        <StepIndicator currentStep={currentStep} />

        {/* Phone Input Step */}
        {(state === 'idle' || isLoading) && (
          <div key="phone" style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            marginTop: 24,
            animation: 'fadeIn 0.3s ease-out',
          }}>
            {isLoading ? (
              <>
                <LoadingDots />
                <p style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', margin: 0 }}>
                  {statusMessage}
                </p>
              </>
            ) : (
              <>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.textPrimary, margin: '0 0 8px' }}>
                  Enter your phone number
                </h2>
                <p style={{ fontSize: 13, color: colors.textSecondary, margin: '0 0 16px' }}>
                  We&apos;ll send a one-time code to verify your identity.
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 14px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  marginBottom: 12,
                  backgroundColor: colors.surface,
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.textMuted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                  </svg>
                  <input
                    style={{
                      flex: 1,
                      border: 'none',
                      outline: 'none',
                      fontSize: 16,
                      color: colors.textPrimary,
                      backgroundColor: 'transparent',
                    }}
                    type="tel"
                    placeholder="+1 555 123 4567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                {/* Honeypot fields — hidden from humans, bots fill them */}
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: -9999,
                    opacity: 0,
                    height: 0,
                    width: 0,
                    overflow: 'hidden',
                    pointerEvents: 'none',
                  }}
                >
                  <input
                    type="text"
                    name="full_name"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypotName}
                    onChange={(e) => setHoneypotName(e.target.value)}
                  />
                  <input
                    type="email"
                    name="email_address"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypotEmail}
                    onChange={(e) => setHoneypotEmail(e.target.value)}
                  />
                  <input
                    type="url"
                    name="website_url"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypotUrl}
                    onChange={(e) => setHoneypotUrl(e.target.value)}
                  />
                </div>
                <button
                  style={{
                    width: '100%',
                    height: 50,
                    fontSize: 16,
                    fontWeight: 600,
                    backgroundColor: !phone ? colors.textMuted : colors.brand500,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 12,
                    cursor: !phone ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.2s',
                  }}
                  onClick={() => startAuth({ honeypotName, honeypotEmail, honeypotUrl })}
                  disabled={!phone}
                >
                  Send OTP
                </button>
              </>
            )}
          </div>
        )}

        {/* OTP Verify Step */}
        {(state === 'otp_sent' || state === 'verifying') && (
          <div key="otp" style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            marginTop: 24,
            animation: 'fadeIn 0.3s ease-out',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: colors.textPrimary, margin: '0 0 8px', textAlign: 'center' }}>
              Enter OTP Code
            </h2>
            <p style={{ fontSize: 13, color: colors.textSecondary, margin: '0 0 16px', textAlign: 'center' }}>
              Check Telegram or backend console for the 6-digit code.
            </p>
            <input
              style={{
                width: '100%',
                textAlign: 'center',
                letterSpacing: 8,
                fontSize: 32,
                fontWeight: 700,
                fontFamily: 'monospace',
                padding: '14px 16px',
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                marginBottom: 12,
                boxSizing: 'border-box',
                color: colors.textPrimary,
              }}
              type="text"
              maxLength={6}
              placeholder="000000"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={state === 'verifying'}
              autoFocus
            />
            <button
              style={{
                width: '100%',
                height: 50,
                fontSize: 16,
                fontWeight: 600,
                backgroundColor: state === 'verifying' || otpCode.length !== 6 ? colors.textMuted : colors.brand500,
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                cursor: state === 'verifying' || otpCode.length !== 6 ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
              onClick={verifyOtp}
              disabled={state === 'verifying' || otpCode.length !== 6}
            >
              {state === 'verifying' ? 'Verifying...' : 'Verify OTP'}
            </button>
            {statusMessage && (
              <p style={{ fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 12, marginBottom: 0 }}>
                {statusMessage}
              </p>
            )}
          </div>
        )}

        {/* Authenticated */}
        {state === 'authenticated' && session && (
          <div key="session" style={{
            backgroundColor: colors.surface,
            borderRadius: 16,
            padding: 24,
            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
            marginTop: 24,
            animation: 'fadeIn 0.3s ease-out',
          }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                backgroundColor: colors.successBg,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                animation: 'scaleIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  backgroundColor: colors.success,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12l5 5L20 7"/>
                  </svg>
                </div>
              </div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.textPrimary, margin: '12px 0 0' }}>Authenticated!</h2>
            </div>

            {[
              { icon: 'M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07', label: 'Phone', value: session.phone },
              { icon: 'M20 16V7a2 2 0 00-2-2H6a2 2 0 00-2 2v9m16 0H4m16 0l1.28 2.55a1 1 0 01-.9 1.45H3.62a1 1 0 01-.9-1.45L4 16', label: 'Device', value: session.device_id.slice(0, 8) + '...' },
              { icon: 'M2 12h4m12 0h4M12 2v4m0 12v4', label: 'Channel', value: session.channel },
              { icon: 'M12 8v4l3 3', label: 'Issued', value: new Date(session.issued_at * 1000).toLocaleString() },
              { icon: 'M12 8v4l3 3M22 12A10 10 0 112 12a10 10 0 0120 0z', label: 'Expires', value: new Date(session.expires_at * 1000).toLocaleString() },
            ].map((row, i) => (
              <div key={row.label} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 0',
                borderTop: i > 0 ? `1px solid ${colors.border}` : 'none',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.brand500} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={row.icon}/>
                </svg>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: colors.textMuted }}>{row.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, fontFamily: 'monospace', color: colors.textPrimary }}>{row.value}</div>
                </div>
              </div>
            ))}

            <button
              style={{
                width: '100%',
                height: 40,
                fontSize: 14,
                fontWeight: 500,
                backgroundColor: colors.bg,
                color: colors.textSecondary,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                cursor: 'pointer',
                marginTop: 16,
              }}
              onClick={reset}
            >
              Sign Out
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: 12,
            backgroundColor: colors.errorBg,
            borderRadius: 12,
            marginTop: 16,
            animation: 'fadeIn 0.2s ease-out',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={colors.error} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/>
            </svg>
            <span style={{ fontSize: 13, color: colors.error }}>{error}</span>
          </div>
        )}

        {/* Defense Card */}
        <div style={{ marginTop: 24 }}>
          <DefenseCard />
        </div>
      </div>
    </div>
  );
}
