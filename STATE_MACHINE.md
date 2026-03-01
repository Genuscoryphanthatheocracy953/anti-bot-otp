# OTP Authentication State Machine

## Client States (iOS / Web)

```
┌──────────────┐
│  IDLE        │  Phone input screen
└──────┬───────┘
       │ user submits phone
       ▼
┌──────────────┐        ┌───────────────────┐
│  ATTESTING   │───────▶│  ATTESTATION_FAIL │──▶ retry or IDLE
│ (mobile only)│        └───────────────────┘
└──────┬───────┘
       │ attestation_jwt received
       ▼
┌──────────────┐        ┌───────────────────┐
│  PREFLIGHT   │───────▶│  PREFLIGHT_FAIL   │──▶ retry or IDLE
└──────┬───────┘        └───────────────────┘
       │ preflight_token + risk_score
       │
       ├── risk ≤ 30 ─────────────────────┐
       │                                  │
       ▼ risk 31–60                       │
┌──────────────┐                          │
│  SOLVING_POW │                          │
└──────┬───────┘                          │
       │ solution found                   │
       ▼                                  │
┌──────────────┐                          │
│  CAPTCHA     │  (web: UI widget)        │
│              │  (PoC: token = "pass")   │
└──────┬───────┘                          │
       │ captcha passed                   │
       ▼                                  │
┌──────────────┐◀─────────────────────────┘
│  SENDING_OTP │
└──────┬───────┘
       │ challenge_id received
       ▼
┌──────────────┐
│  OTP_SENT    │  Waiting for user to enter code
│              │  (can resend after 60s cooldown)
└──────┬───────┘
       │ user enters code
       ▼
┌──────────────┐        ┌───────────────────┐
│ VERIFYING_OTP│───────▶│  OTP_FAILED       │──▶ re-enter (≤5 attempts) or IDLE
└──────┬───────┘        └───────────────────┘
       │ verified = true
       ▼
┌──────────────┐
│AUTHENTICATED │  access_token + refresh_token stored
└──────────────┘
```

## Server-Side Request Pipeline

Every `/v1/*` request passes through these layers in order:

```
Request
  │
  ▼
┌──────────────────────┐
│ 1. Request Context   │  Extract IP, subnet, deviceId, channel, fingerprint, UA
└──────────┬───────────┘
           ▼
┌──────────────────────┐
│ 2. HMAC Verify       │  Validate x-signature, x-timestamp, x-nonce
│                      │  Reject replay (nonce TTL 60s), drift > 30s
└──────────┬───────────┘
           ▼
  Route-specific middleware (see below)
           ▼
  Route handler
```

## Endpoint State Transitions

### 1. `POST /v1/device/attest` — Issue Attestation Challenge

```
Guards:  HMAC
Input:   { device_id }
Output:  { challenge, challenge_id }
Redis:   SET attest:{challenge_id}  TTL 5min
```

### 2. `POST /v1/device/attest/verify` — Verify Attestation

```
Guards:  HMAC
Input:   { challenge_id, device_id, challenge, signed_response, public_key, app_id }
Output:  { attestation_jwt }  (24h TTL)
Redis:   DEL attest:{challenge_id}  (one-time use)
Effect:  Client stores JWT in Keychain / localStorage
```

### 3. `POST /v1/auth/preflight` — Start Auth Session

```
Guards:  HMAC → Rate Limit (IP: 30/10min, Subnet: 100/10min, Device: 20/10min)
Input:   { channel, device_id, fingerprint? }
Output:  { token, session_id, risk_score, expires_at, pow_challenge?, requires_pow?, requires_captcha? }

Risk score computation (0–100):
  ┌────────────────────────┬────────┐
  │ Factor                 │ Points │
  ├────────────────────────┼────────┤
  │ Velocity (>10 req/60s) │ 0–20   │
  │ Datacenter IP          │ 0–25   │
  │ Abnormal headers (web) │ 0–15   │
  │ Failed PoW             │ 0–15   │
  │ Failed CAPTCHA         │ 0–10   │
  │ Failed attestation     │ 0–10   │
  │ Device/phone mismatch  │ 0–5    │
  └────────────────────────┴────────┘

Decision:
  score ≤ 30  → LOW risk, no challenges
  score 31–60 → MID risk, PoW + CAPTCHA required (challenge issued inline)
  score > 60  → HIGH risk, request blocked
```

### 4. `POST /v1/challenge/pow/issue` — Issue PoW Challenge

```
Guards:  HMAC
Input:   { device_id, difficulty? }
Output:  { nonce, difficulty, challenge_id }
Redis:   SET pow:{challenge_id}  TTL 5min
```

### 5. `POST /v1/challenge/pow/verify` — Verify PoW Solution

```
Guards:  HMAC
Input:   { nonce, solution, challenge_id }
Check:   SHA256(nonce + solution) has N leading zero bits
Output:  { verified: true }
Redis:   DEL pow:{challenge_id}  (one-time use)
Failure: recordFailure(redis, 'pow', deviceId) → increases risk score
```

### 6. `POST /v1/challenge/captcha/verify` — Verify CAPTCHA

```
Guards:  HMAC
Input:   { token }
Check:   token === "pass" (PoC stub; production: Turnstile/hCaptcha)
Output:  { verified: true }
Failure: recordFailure(redis, 'captcha', deviceId)
```

### 7. `POST /v1/auth/otp/send` — Send OTP

```
Guards:  HMAC → Rate Limit (Phone: 5/hr, IP: 20/hr, Device: 10/hr)
         → Preflight Guard → Attestation Guard (mobile) → Risk Gate

Preflight Guard:
  - Verify x-preflight-token JWT (HS256, PREFLIGHT_SECRET)
  - Check IP hash matches current IP
  - Check device_id matches
  - Mark JTI consumed in Redis (one-time use)

Attestation Guard (mobile only):
  - Verify x-attestation-token JWT
  - Skip for web channel

Risk Gate:
  - Re-compute risk score
  - score > 60 → BLOCK (403)
  - score 31–60 → require x-pow-solution + x-captcha-token headers
  - score ≤ 30 → ALLOW

Input:   { phone, purpose? }
Output:  { challenge_id, expires_at, purpose }

OTP creation:
  - Generate 6-digit code
  - Store Argon2id hash in Redis (TTL 10min)
  - Bind to: challenge_id + device_id + phone + channel
  - Max 5 verify attempts
  - Send via Telegram bot (or console log in dev)
  - 60s resend cooldown per phone+purpose
```

### 8. `POST /v1/auth/otp/verify` — Verify OTP & Issue Session

```
Guards:  HMAC → Rate Limit (Phone: 15/hr, IP: 30/hr, Device: 20/hr)
Input:   { phone, code, challenge_id, device_id, purpose? }

Verification:
  1. Fetch OTP record from Redis
  2. Validate challenge_id binding
  3. Validate device_id binding
  4. Check attempts < 5
  5. Argon2id verify code against stored hash
  6. On match → delete from Redis, mark verified in Postgres

On success → Issue session:
  - Access token:  JWT (15min TTL, signed JWT_SECRET)
    { jti, sub: phone, device_id, channel }
  - Refresh token: JWT (7d TTL, signed REFRESH_TOKEN_SECRET)
    { jti, sub: phone, device_id, type: "refresh" }
  - Web: refresh_token set as httpOnly cookie
  - Mobile: refresh_token returned in response body

Output:  { access_token, refresh_token?, token_type: "Bearer", expires_in: 900 }
```

### 9. `GET /v1/auth/session/me` — Get Current Session

```
Guards:  HMAC
Input:   Authorization: Bearer {access_token}
Check:   Verify JWT + check revocation in Redis
Output:  { phone, device_id, channel, issued_at, expires_at }
```

## Redis Key Map

```
Key Pattern                     Purpose                    TTL
─────────────────────────────────────────────────────────────────
rl:{dim}:{id}                   Rate limit sliding window  varies
otp:{phone}:{purpose}           OTP hash + metadata        10min
otp:cooldown:{phone}:{purpose}  Resend cooldown            60s
preflight:jti:{jti}             Preflight token consumed   10min
pow:{challenge_id}              PoW challenge nonce         5min
hmac:nonce:{nonce}              HMAC replay prevention     60s
risk:velocity:{device_id}       Request velocity counter   60s
risk:fail:{type}:{device_id}    Failure counter             1hr
device:phones:{device_id}       Device→phone set           24hr
attest:{challenge_id}           Attestation challenge       5min
session:revoked:{jti}           Revoked session marker     15min
```

## Anti-Bot Defense Layers (in order)

| # | Layer           | Mechanism                          | Blocks                          |
|---|-----------------|------------------------------------|---------------------------------|
| 1 | HMAC Signing    | SHA256 request signature + nonce   | Replay, tampering, no SDK       |
| 2 | Rate Limiting   | Sliding window per IP/device/phone | Brute force, enumeration        |
| 3 | Risk Scoring    | 7-factor behavioral analysis       | Datacenter IPs, anomalies       |
| 4 | Attestation     | P256 ECDSA device signature        | Emulators, non-genuine apps     |
| 5 | Proof-of-Work   | SHA256 hash puzzle (adaptive)      | Automated bulk requests         |
| 6 | CAPTCHA         | Challenge-response token           | Bots without human interaction  |
| 7 | OTP Binding     | challenge_id + device_id binding   | Token theft, session hijacking  |

## PostgreSQL Audit Tables

```
devices       — Track device_id, channel, first/last seen
otp_requests  — Every OTP issued: phone, device, IP, risk, status
sessions      — Active sessions: phone, device, JTIs, expiry
audit_log     — All events: preflight, otp_send, otp_verify + metadata
```
