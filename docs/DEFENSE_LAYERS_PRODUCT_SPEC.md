# OTP Authentication PoC — Security Defense Layers
## Product Owner Specification

**Document Version**: 1.0
**Date**: 2026-03-04
**Status**: Reference — Proof of Concept
**Platforms**: Backend (Node.js/Fastify), Web (Next.js), Mobile (iOS SwiftUI, Flutter iOS/Android)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Authentication Flow](#3-authentication-flow)
4. [Defense Layer 1 — HMAC Request Signing](#4-defense-layer-1--hmac-request-signing)
5. [Defense Layer 2 — Preflight Token](#5-defense-layer-2--preflight-token)
6. [Defense Layer 3 — Multi-Dimensional Rate Limiting](#6-defense-layer-3--multi-dimensional-rate-limiting)
7. [Defense Layer 4 — Risk Scoring Engine](#7-defense-layer-4--risk-scoring-engine)
8. [Defense Layer 5 — Proof-of-Work Challenge](#8-defense-layer-5--proof-of-work-challenge)
9. [Defense Layer 6 — Device Attestation](#9-defense-layer-6--device-attestation)
10. [Defense Layer 7 — Browser/Device Fingerprinting](#10-defense-layer-7--browserdevice-fingerprinting)
11. [Defense Layer 8 — OTP Binding (argon2id)](#11-defense-layer-8--otp-binding-argon2id)
12. [Defense Layer 9 — Honeypot Traps](#12-defense-layer-9--honeypot-traps)
13. [Defense Layer 10 — Automation Detection](#13-defense-layer-10--automation-detection)
14. [Defense Layer 11 — Timing Analysis](#14-defense-layer-11--timing-analysis)
15. [Platform Coverage Matrix](#15-platform-coverage-matrix)
16. [Error Codes and HTTP Status Reference](#16-error-codes-and-http-status-reference)
17. [Risk Decision Matrix](#17-risk-decision-matrix)
18. [Data Storage and Audit Trail](#18-data-storage-and-audit-trail)
19. [Configuration Parameters](#19-configuration-parameters)
20. [Acceptance Criteria](#20-acceptance-criteria)
21. [Glossary](#21-glossary)

---

## 1. Executive Summary

This system implements **11 independent, server-enforced defense layers** that work in concert to protect the OTP-based authentication flow against automated abuse, credential stuffing, phone enumeration, and bot-driven attacks.

**Key Principles:**
- **Defense in Depth**: No single layer is a single point of failure. All 11 layers contribute signals to a unified risk model.
- **Server-Enforced**: Every security decision is made server-side. Client-side checks serve as signal collectors only; they cannot be bypassed to gain access.
- **Adaptive Difficulty**: The system dynamically escalates challenges (PoW, CAPTCHA) based on real-time risk assessment rather than applying blanket restrictions.
- **Cross-Platform Parity**: Web, iOS, and Flutter (iOS/Android) clients implement identical signal collection, ensuring uniform protection regardless of platform.

**What This Protects Against:**

| Threat | Primary Defenses |
|--------|-----------------|
| SMS pumping / toll fraud | Rate limiting, PoW, risk scoring |
| Phone number enumeration | Rate limiting, timing analysis, risk scoring |
| Credential stuffing bots | Automation detection, honeypots, fingerprinting |
| API scraping / replay attacks | HMAC signing, nonce deduplication, preflight tokens |
| Emulator/rooted device abuse | Device attestation, integrity checks |
| Man-in-the-middle tampering | HMAC request signing, token binding |
| Brute-force OTP guessing | Rate limiting, attempt caps, argon2id hashing |
| Session hijacking | OTP binding (device + challenge), IP binding |

---

## 2. System Architecture Overview

```
                         CLIENT PLATFORMS
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Web (Next)  │  │  iOS (Swift) │  │ Flutter (iOS │
    │              │  │              │  │  + Android)  │
    └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
           │                 │                  │
           │  HMAC-signed requests over HTTP    │
           └─────────────────┼──────────────────┘
                             │
                    ┌────────▼────────┐
                    │   BACKEND API   │
                    │  (Fastify/Node) │
                    ├─────────────────┤
                    │ Middleware Chain │
                    │ ┌─────────────┐ │
                    │ │ HMAC Verify │◄├── Layer 1
                    │ ├─────────────┤ │
                    │ │ Rate Limit  │◄├── Layer 3
                    │ ├─────────────┤ │
                    │ │ Preflight   │◄├── Layer 2
                    │ │   Guard     │ │
                    │ ├─────────────┤ │
                    │ │ Attestation │◄├── Layer 6
                    │ │   Guard     │ │
                    │ └─────────────┘ │
                    ├─────────────────┤
                    │ Service Layer   │
                    │ ┌─────────────┐ │
                    │ │Risk Scoring │◄├── Layer 4 (aggregates Layers 7-11)
                    │ ├─────────────┤ │
                    │ │PoW Service  │◄├── Layer 5
                    │ ├─────────────┤ │
                    │ │OTP Service  │◄├── Layer 8
                    │ └─────────────┘ │
                    └────────┬────────┘
                             │
                   ┌─────────┼─────────┐
                   │         │         │
              ┌────▼───┐ ┌───▼──┐ ┌───▼────┐
              │ Redis  │ │ Postgres │ │ (SMS   │
              │ Cache  │ │ Audit DB │ │ Stub)  │
              └────────┘ └────────┘  └────────┘
```

**Request Processing Order:**
1. HMAC signature verified (Layer 1)
2. Rate limits checked across all dimensions (Layer 3)
3. Preflight token validated and consumed (Layer 2)
4. Attestation token verified for mobile channel (Layer 6)
5. Client signals evaluated by risk engine (Layers 4, 7-11)
6. Adaptive challenges issued if risk is elevated (Layer 5)
7. OTP issued with cryptographic binding (Layer 8)

---

## 3. Authentication Flow

### 3.1 Happy Path (Low-Risk User)

```
Step 1: User opens app / page
   └─ Client records page_load_ts (timing baseline)

Step 2: User types phone number
   └─ Client records first_interaction_ts

Step 3: User taps "Send OTP"
   ├─ Client collects: automation signals, fingerprint, timing data, honeypots
   ├─ Client sends PREFLIGHT request (HMAC-signed)
   ├─ Server evaluates risk score
   │   └─ Risk = 12 (low) → No PoW, no CAPTCHA required
   ├─ Server returns preflight token (120s TTL)
   ├─ Client sends OTP request with preflight token
   └─ Server generates 6-digit OTP, hashes with argon2id, sends SMS

Step 4: User enters 6-digit code
   ├─ Client sends VERIFY request with code + challenge_id + device_id
   ├─ Server verifies argon2id hash + binding (device, phone, challenge)
   └─ Server issues access_token + refresh_token

Step 5: Authenticated session established
```

### 3.2 Elevated Risk Path (Suspicious User)

```
Same as above, but at Step 3:
   ├─ Server evaluates risk score
   │   └─ Risk = 45 (medium) → PoW + CAPTCHA required
   ├─ Server returns preflight token + PoW challenge (nonce, difficulty)
   ├─ Client solves PoW (compute-intensive SHA256 puzzle)
   ├─ Client submits PoW solution + CAPTCHA token
   └─ Server validates both before issuing OTP
```

### 3.3 Blocked Path (High-Risk User)

```
Same as above, but at Step 3:
   ├─ Server evaluates risk score
   │   └─ Risk = 72 (high) → Request BLOCKED
   └─ Server returns 403 RISK_BLOCKED
```

---

## 4. Defense Layer 1 — HMAC Request Signing

### Purpose
Prevent request tampering, replay attacks, and unauthorized API access by requiring every request to carry a cryptographic signature that proves the client possesses a shared secret key.

### How It Works

Every request to `/v1/*` endpoints must include three headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Signature` | HMAC-SHA256 hex string | Proves request integrity |
| `X-Timestamp` | Unix seconds | Prevents replay outside window |
| `X-Nonce` | UUID v4 | Prevents exact replay within window |

**Signature is computed as:**
```
body_hash  = SHA256(raw_request_body)    // empty string if no body
payload    = "METHOD\nPATH\nTIMESTAMP\nBODY_HASH"
signature  = HMAC-SHA256(CLIENT_KEY, payload)
```

### Validation Rules

| Rule | Value | Consequence if Failed |
|------|-------|-----------------------|
| Timestamp drift | +/- 30 seconds | 401 INVALID_SIGNATURE |
| Nonce uniqueness | 60-second TTL in Redis | 401 INVALID_SIGNATURE (replay detected) |
| Signature match | Exact hex comparison | 401 INVALID_SIGNATURE |
| Body hash match | SHA256 of raw bytes | 401 INVALID_SIGNATURE |

### Critical Implementation Detail
The body JSON must be encoded with **sorted keys** (alphabetical) before hashing. Both client and server must produce the same byte-for-byte JSON output. The web client, iOS app, and Flutter app all sort keys recursively before encoding.

### Platform Implementation

| Platform | Approach |
|----------|----------|
| **Web** | `crypto.subtle.sign('HMAC', ...)` via Web Crypto API |
| **iOS** | `CryptoKit.HMAC<SHA256>` |
| **Flutter** | `package:crypto` Hmac(sha256, key) |
| **Backend** | Node.js `crypto.createHmac('sha256', key)` |

---

## 5. Defense Layer 2 — Preflight Token

### Purpose
Establish a short-lived, one-time-use session token that binds the client's IP address, device ID, and risk assessment to a specific OTP request window. This prevents token reuse and ensures the same device/network that was risk-assessed is the one sending the OTP.

### How It Works

1. Client calls `POST /v1/auth/preflight` with device info + signals
2. Server evaluates risk, generates JWT with embedded context
3. Client must present this token within 120 seconds to `POST /v1/auth/otp/send`
4. Token is **consumed on use** (one-time only, tracked via JTI in Redis)

### Token Properties

| Property | Value |
|----------|-------|
| Format | JWT (HS256) |
| TTL | **120 seconds** (2 minutes) |
| Usage | **One-time** (JTI tracked in Redis) |
| IP Binding | SHA256 of client IP embedded; verified on consumption |
| Device Binding | device_id embedded; must match on consumption |

### Token Payload
```json
{
  "jti": "unique-token-id",
  "session_id": "session-tracking-id",
  "device_id": "client-device-id",
  "ip_hash": "sha256-of-client-ip",
  "channel": "web | mobile",
  "risk_score": 0-100,
  "iat": 1709553600,
  "exp": 1709553720
}
```

### What This Prevents
- Attackers cannot reuse a captured preflight token (one-time use)
- Attackers cannot use a token from a different IP address (IP binding)
- Attackers cannot use a token meant for a different device (device binding)
- Tokens expire before attackers can brute-force or reverse-engineer them (120s TTL)

---

## 6. Defense Layer 3 — Multi-Dimensional Rate Limiting

### Purpose
Prevent brute-force attacks, phone enumeration, and resource exhaustion by enforcing sliding-window rate limits across multiple independent dimensions. An attacker must evade ALL dimensions simultaneously to bypass limits.

### How It Works
Every request is checked against multiple rate limit buckets. Each bucket tracks a different dimension (IP, device, phone, fingerprint, subnet). Limits are enforced atomically using a Redis Lua script with a sliding window algorithm.

### Rate Limit Configuration

#### Preflight Endpoint (`/v1/auth/preflight`)

| Dimension | Limit | Window |
|-----------|-------|--------|
| IP address | 30 requests | 10 minutes |
| /24 Subnet | 100 requests | 10 minutes |
| Device ID | 20 requests | 10 minutes |

#### OTP Send Endpoint (`/v1/auth/otp/send`)

| Dimension | Limit | Window |
|-----------|-------|--------|
| Phone number | 5 requests | 1 hour |
| IP address | 20 requests | 1 hour |
| /24 Subnet | 50 requests | 1 hour |
| Device ID | 10 requests | 1 hour |
| Fingerprint | 10 requests | 1 hour |

#### OTP Verify Endpoint (`/v1/auth/otp/verify`)

| Dimension | Limit | Window |
|-----------|-------|--------|
| Phone number | 15 requests | 1 hour |
| IP address | 30 requests | 1 hour |
| Device ID | 20 requests | 1 hour |

### When Limit Is Exceeded
- **HTTP Status**: 429
- **Error Code**: `RATE_LIMITED`
- **Retry-After Header**: Seconds until the client can retry
- **User-facing message**: "Too many requests. Please try again in X seconds."

### Why Multiple Dimensions Matter
| Attack Pattern | Dimension That Catches It |
|---------------|--------------------------|
| Single bot, one IP | IP rate limit |
| Bot farm, same /24 subnet | Subnet rate limit |
| Rotating IPs, same device | Device ID rate limit |
| Rotating devices, same phone | Phone rate limit |
| Rotating everything, same browser profile | Fingerprint rate limit |

---

## 7. Defense Layer 4 — Risk Scoring Engine

### Purpose
Aggregate behavioral signals from all other defense layers into a single 0-100 risk score that determines the level of challenge presented to the user. This enables adaptive security that is frictionless for legitimate users but increasingly costly for attackers.

### How It Works
The risk engine evaluates 10 independent factors during the preflight phase. Each factor contributes 0 to N risk points, and the final score is capped at 100.

### Risk Factors

| # | Factor | Max Points | What It Detects |
|---|--------|-----------|-----------------|
| 1 | Request Velocity | 20 | Rapid-fire requests from same device |
| 2 | Datacenter IP | 25 | Requests from known cloud/VPS ranges |
| 3 | Abnormal Headers | 15 | Missing User-Agent, Accept-Language, fingerprint |
| 4 | Failed PoW History | 15 | Previous failed proof-of-work attempts |
| 5 | Failed CAPTCHA History | 10 | Previous failed CAPTCHA attempts |
| 6 | Failed Attestation | 10 | Previous attestation failures |
| 7 | Device/Phone Mismatch | 5 | One device trying many phone numbers |
| 8 | Honeypot Triggered | 25 | Hidden fields filled or jailbreak detected |
| 9 | Automation Detected | 20 | Browser automation tools or suspicious libraries |
| 10 | Suspicious Timing | 10 | Inhuman speed patterns |

### Risk Thresholds and Actions

| Score Range | Classification | Action Taken |
|-------------|---------------|--------------|
| **0 - 30** | Low Risk | Allow — no additional challenges |
| **31 - 60** | Medium Risk | Challenge — require PoW and/or CAPTCHA |
| **61 - 100** | High Risk | Block — reject request with 403 |

### Velocity Tracking Detail
- Tracked per device_id in Redis (60-second sliding window)
- 2 points per recent request, max 10 counted = max 20 points
- Decays automatically as the window slides

### Datacenter IP Ranges Detected
AWS (52.0.0.0/11), GCP (35.192.0.0/11), Azure (13.64.0.0/11), DigitalOcean (134.209.0.0/16), Cloudflare (104.16.0.0/12), and private/reserved ranges.

---

## 8. Defense Layer 5 — Proof-of-Work Challenge

### Purpose
Impose a computational cost on clients when the risk score is elevated (31-60), making bulk automated requests economically infeasible while remaining a minor inconvenience for legitimate users.

### How It Works

1. Server generates a random nonce and specifies a difficulty level
2. Client must find an integer `counter` such that:
   ```
   SHA256(nonce + counter) has N leading zero bits
   ```
3. Client submits the solution; server verifies in constant time

### Challenge Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Algorithm | SHA-256 | Standard, hardware-accelerated on all platforms |
| Default Difficulty | 4 leading zero bits | Configurable via `POW_DIFFICULTY` env var |
| Challenge TTL | 300 seconds (5 minutes) | Time to solve before challenge expires |
| Usage | One-time | Challenge consumed on successful verification |

### Expected Solve Times

| Difficulty (bits) | Average Attempts | Approx. Time (modern device) |
|-------------------|-----------------|------------------------------|
| 4 | ~16 | < 1 ms |
| 8 | ~256 | ~5 ms |
| 12 | ~4,096 | ~50 ms |
| 16 | ~65,536 | ~500 ms |
| 20 | ~1,048,576 | ~5 seconds |

### Platform Implementation

| Platform | Approach | UI Impact |
|----------|----------|-----------|
| **Web** | Main thread with `setTimeout(0)` yield every 10K iterations | Non-blocking, progress shown |
| **iOS** | `DispatchQueue.global(qos: .userInitiated)` | Background thread |
| **Flutter** | `Isolate.run()` | Separate isolate, zero UI jank |

### Impact on Attackers
At difficulty 16, an attacker sending 1,000 OTP requests would need ~500 CPU-seconds. At difficulty 20, the same volume requires ~83 CPU-minutes — making large-scale abuse cost-prohibitive.

---

## 9. Defense Layer 6 — Device Attestation

### Purpose
Verify that mobile clients are running on genuine, unmodified devices rather than emulators, rooted/jailbroken devices, or automated testing frameworks.

### How It Works

**Challenge-Response Protocol:**
```
1. Client  → Server:  POST /v1/device/attest  { device_id }
2. Server  → Client:  { challenge: "random-32-bytes", challenge_id: "uuid" }
3. Client signs challenge with device-resident P256 private key
4. Client  → Server:  POST /v1/device/attest/verify
                       { challenge_id, device_id, signed_response,
                         public_key (PEM/SPKI), app_id }
5. Server verifies ECDSA signature against provided public key
6. Server  → Client:  { attestation_jwt (24h TTL) }
```

### Attestation JWT Properties

| Property | Value |
|----------|-------|
| Algorithm | HS256 |
| TTL | **24 hours** |
| Contents | device_id, app_id, type: "attestation" |
| Storage | iOS Keychain / Android Keystore / Flutter Secure Storage |

### Key Format
- **Algorithm**: ECDSA with P-256 curve
- **Public Key Format**: ASN.1 SPKI (91 bytes: 26-byte header + 65-byte uncompressed point)
- **Signature Format**: DER-encoded (ASN1Sequence of two ASN1Integer r, s values)
- **Key Storage**: Private key in platform secure enclave (Keychain / Keystore)

### Where It Applies

| Channel | Required? | Notes |
|---------|-----------|-------|
| **Mobile (iOS/Android)** | Yes | Enforced by attestation-guard middleware |
| **Web** | No | Web has no equivalent attestation API |

### Note for Production
This PoC uses a custom P256 challenge-response. In production, this should be replaced with Apple App Attest (iOS) and Google Play Integrity API (Android) for hardware-backed attestation.

---

## 10. Defense Layer 7 — Browser/Device Fingerprinting

### Purpose
Create a semi-persistent device identifier from observable browser/device characteristics. This enables fingerprint-based rate limiting and helps detect cloned or spoofed device profiles.

### Signals Collected

| Signal | Source | Example |
|--------|--------|---------|
| User-Agent | Browser/OS string | `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0...` |
| Accept-Language | Browser locale | `en-US,en;q=0.9` |
| Timezone | System timezone | `America/New_York` |
| Screen | Resolution + color depth | `1170x2532x3` |
| Cookie ID | Persistent local storage UUID | `a1b2c3d4-...` |

### Fingerprint Computation
```
raw  = "userAgent|acceptLanguage|timezone|screen|cookieId"
hash = SHA-256(raw) → hex string
```

### How It Is Used

| Use Case | Mechanism |
|----------|-----------|
| Rate limiting dimension | `fingerprint` bucket in OTP send (max 10/hour) |
| Risk scoring signal | Missing fingerprint = +5 risk points |
| Audit trail | Logged with every request for forensic analysis |

### Platform Implementation

| Platform | Fingerprint Source |
|----------|--------------------|
| **Web** | Browser APIs: `navigator.userAgent`, `Intl.DateTimeFormat`, `screen.*`, localStorage |
| **Mobile** | Sent as header; device-level identifiers in secure storage |

---

## 11. Defense Layer 8 — OTP Binding (argon2id)

### Purpose
Ensure that OTP codes are (a) securely hashed at rest using a memory-hard algorithm resistant to GPU cracking, and (b) cryptographically bound to the specific session context (device, phone, challenge) so that an intercepted OTP cannot be used from a different device or session.

### OTP Generation

| Property | Value |
|----------|-------|
| Length | 6 digits (configurable) |
| Generation | Cryptographic random integer, zero-padded |
| Hash algorithm | **argon2id** (OWASP-recommended) |
| Memory cost | 19,456 KiB |
| Time cost | 2 iterations |
| Parallelism | 1 thread |

### OTP Binding — What Is Stored

When an OTP is issued, the following context is stored in Redis and bound to the hashed code:

```json
{
  "hash": "argon2id$...",
  "challenge_id": "uuid",
  "device_id": "requesting-device-id",
  "phone": "+1234567890",
  "purpose": "login",
  "channel": "web | mobile",
  "attempts": 0,
  "max_attempts": 5,
  "risk_score": 12,
  "created_at": 1709553600,
  "expires_at": 1709553780
}
```

### Verification Binding Checks

When a user submits an OTP code, ALL of the following must match:

| Binding | What Is Checked |
|---------|----------------|
| Phone | Submitted phone must match stored phone |
| Challenge ID | Submitted challenge_id must match stored challenge_id |
| Device ID | Submitted device_id must match stored device_id |
| Purpose | Must match original purpose (login/signup) |
| Argon2id hash | Code hash must verify against stored hash |

### OTP Lifecycle Limits

| Parameter | Value | Error Code |
|-----------|-------|------------|
| TTL | 180 seconds (3 minutes) | 410 `OTP_EXPIRED` |
| Max verify attempts | 5 | 429 `OTP_EXHAUSTED` |
| Resend cooldown | 60 seconds | 429 `RATE_LIMITED` |
| Max sends per phone per hour | 5 | 429 `RATE_LIMITED` |

### What This Prevents
- **OTP interception replay**: Attacker intercepts code but cannot use it without the original device_id and challenge_id
- **Offline cracking**: Argon2id makes brute-force of captured hashes computationally expensive (19 MB memory per attempt)
- **Enumeration**: Attempt cap + rate limits prevent guessing all 1,000,000 possible 6-digit codes

---

## 12. Defense Layer 9 — Honeypot Traps

### Purpose
Detect automated form-filling tools by presenting invisible input fields that real users never interact with but automated scripts blindly populate.

### Web Implementation

Three hidden HTML input fields rendered with CSS that makes them invisible to humans:
- `full_name` (text input)
- `email_address` (email input)
- `website_url` (URL input)

**Hiding Technique:**
```css
position: absolute; left: -9999px; opacity: 0;
height: 0; width: 0; overflow: hidden; pointer-events: none;
```
- Fields have `tabIndex={-1}` (not reachable via keyboard navigation)
- Fields have `autocomplete="off"` (browser won't autofill)
- Fields are `aria-hidden="true"` (screen readers skip them)

### Mobile Implementation

Mobile platforms don't use form-based honeypots. Instead, the mobile equivalent signals are:
- **Jailbreak/root detection** results (device tampering = honeypot equivalent)
- **Debugger attachment** detection

### Risk Impact

| Trigger | Risk Points |
|---------|-------------|
| Any web honeypot field filled | **+25 points** (immediate) |
| Jailbreak or debugger detected (mobile) | **+25 points** (immediate) |

A honeypot trigger alone pushes risk to 25+, which combined with any other signal will likely cross the 31-point threshold for PoW/CAPTCHA challenges.

---

## 13. Defense Layer 10 — Automation Detection

### Purpose
Identify requests originating from browser automation frameworks (Selenium, Puppeteer, Playwright) or compromised mobile environments (jailbreak, Frida injection).

### Web Signals (7 Checks)

| Signal | Risk Points | Detection Method |
|--------|-------------|-----------------|
| `webdriver` | 8 | `navigator.webdriver === true` |
| `headless` | 4 | HeadlessChrome in UA or missing `window.chrome` |
| `selenium` | 4 | Presence of `__selenium_unwrapped`, `__webdriver_evaluate` globals |
| `puppeteer` | 4 | Presence of `__puppeteer_evaluation_script__` global |
| `playwright` | 4 | Presence of `__playwright`, `__pw_manual` globals |
| `plugins_missing` | 2 | Chrome with zero plugins (`navigator.plugins.length === 0`) |
| `languages_empty` | 2 | Empty languages array (`navigator.languages.length === 0`) |

**Total cap**: 20 points (even if all signals fire)

### Mobile Signals (3 Checks)

| Signal | Risk Points | Detection Method |
|--------|-------------|-----------------|
| `jailbroken` / `rooted` | 8 | iOS: 15+ filesystem paths (Cydia, Sileo, etc.) + sandbox write test. Android: 14 root paths + `test-keys` build tag |
| `debugger_attached` | 6 | iOS: debug mode assert trick. Android: Frida port 27042 check |
| `suspicious_dylibs` / `libraries` | 4 | iOS: `DYLD_INSERT_LIBRARIES` check. Android: `/proc/self/maps` scan for frida/xposed/substrate/magisk |

**Total cap**: 20 points

### iOS-Specific Jailbreak Paths Checked
`/Applications/Cydia.app`, `/Applications/Sileo.app`, `/Applications/Zebra.app`, `/usr/sbin/sshd`, `/bin/bash`, `/usr/local/bin/frida-server`, `/usr/bin/cycript`, `/Library/MobileSubstrate/MobileSubstrate.dylib`, and more (15 total).

### Android-Specific Root Paths Checked
`/system/xbin/su`, `/system/bin/su`, `/sbin/su`, `/system/app/Superuser.apk`, `/system/app/SuperSU.apk`, `/sbin/magisk`, `/system/bin/magisk`, and more (14 total).

---

## 14. Defense Layer 11 — Timing Analysis

### Purpose
Distinguish human interaction patterns from automated scripts by measuring the time between page load, first user interaction, and form submission. Bots typically complete forms in milliseconds; humans take seconds.

### Timestamps Collected

| Timestamp | When Recorded | Platform |
|-----------|---------------|----------|
| `page_load_ts` | Component mounts / view loads | All |
| `first_interaction_ts` | First keystroke in phone field | All |
| `form_submit_ts` | User taps "Send OTP" | All |

### Timing Thresholds

| Duration | Classification | Risk Points |
|----------|---------------|-------------|
| Load-to-submit < **500ms** | Certain bot | **10 points** |
| Load-to-submit < **1,500ms** | Very likely bot | **7 points** |
| Load-to-submit < **3,000ms** | Mild suspicion | **4 points** |
| First-interaction-to-submit < **100ms** | Instant fill (bot) | **8 points** |
| Load-to-submit > **3,000ms** | Normal human | **0 points** |

### Validation Rules
- All timestamps must be positive integers
- Must be chronologically ordered: `page_load <= first_interaction <= form_submit`
- Must be recent: `(now - page_load) <= 5 minutes`
- Must not be from the future (5-second clock skew tolerance)
- Invalid or missing timing data = **0 points** (no penalty)

### Behavioral Insight
A typical human user takes 5-15 seconds to read the screen, focus the input, type a phone number, and tap the button. A well-written bot completes this in under 100ms, which is physically impossible for a human.

---

## 15. Platform Coverage Matrix

| Defense Layer | Backend | Web | iOS (Swift) | Flutter (iOS) | Flutter (Android) |
|--------------|---------|-----|-------------|---------------|-------------------|
| 1. HMAC Signing | Verify | Sign | Sign | Sign | Sign |
| 2. Preflight Token | Issue + Verify | Send | Send | Send | Send |
| 3. Rate Limiting | Enforce | N/A (server) | N/A (server) | N/A (server) | N/A (server) |
| 4. Risk Scoring | Compute | N/A (server) | N/A (server) | N/A (server) | N/A (server) |
| 5. Proof-of-Work | Issue + Verify | Solve (main thread) | Solve (background) | Solve (Isolate) | Solve (Isolate) |
| 6. Device Attestation | Verify + Issue JWT | N/A | P256 sign | P256 sign | P256 sign |
| 7. Fingerprinting | Hash + store | Collect 5 signals | Device ID | Device ID | Device ID |
| 8. OTP Binding | Argon2id hash + verify | Send bindings | Send bindings | Send bindings | Send bindings |
| 9. Honeypot Traps | Score signals | 3 hidden fields | Jailbreak signals | Jailbreak/root | Root signals |
| 10. Automation Detection | Score signals | 7 browser checks | 3 iOS checks | 3 iOS checks | 3 Android checks |
| 11. Timing Analysis | Evaluate thresholds | 3 timestamps | 3 timestamps | 3 timestamps | 3 timestamps |

---

## 16. Error Codes and HTTP Status Reference

| HTTP Status | Error Code | Description | Trigger |
|-------------|-----------|-------------|---------|
| 400 | `INVALID_POW` | Proof-of-work solution incorrect | Hash doesn't meet difficulty |
| 400 | `INVALID_CAPTCHA` | CAPTCHA verification failed | Invalid CAPTCHA token |
| 401 | `INVALID_SIGNATURE` | HMAC signature invalid or missing | Tampered/expired/replayed request |
| 401 | `PREFLIGHT_REQUIRED` | Preflight token missing or invalid | Token expired, consumed, or IP/device mismatch |
| 401 | `ATTESTATION_REQUIRED` | Attestation token required | Mobile channel without valid attestation JWT |
| 401 | `INVALID_OTP` | OTP code incorrect | Argon2id hash mismatch |
| 401 | `INVALID_TOKEN` | Session token invalid | JWT verification failed |
| 403 | `RISK_BLOCKED` | Request blocked (high risk) | Risk score > 60 |
| 410 | `OTP_EXPIRED` | OTP code has expired | TTL exceeded (>180 seconds) |
| 428 | `POW_REQUIRED` | Proof-of-work solution required | Risk 31-60, PoW not provided |
| 428 | `CAPTCHA_REQUIRED` | CAPTCHA required | Risk 31-60, CAPTCHA not provided |
| 429 | `RATE_LIMITED` | Too many requests | Any rate limit dimension exceeded |
| 429 | `OTP_EXHAUSTED` | Max OTP attempts exceeded | 5 failed verification attempts |

---

## 17. Risk Decision Matrix

```
Score:  0          30          60          100
        |__________|___________|___________|
        |  LOW     |  MEDIUM   |   HIGH    |
        |  RISK    |  RISK     |   RISK    |
        |          |           |           |
Action: ALLOW      CHALLENGE    BLOCK
        (no extra  (PoW +       (403
        friction)  CAPTCHA)     rejected)
```

### How Individual Factors Combine (Examples)

| Scenario | Factors | Score | Action |
|----------|---------|-------|--------|
| Normal user, clean device | None triggered | 0-5 | Allow |
| Normal user, datacenter IP (VPN) | Datacenter IP (25) | 25 | Allow |
| Bot with headless browser | Webdriver (8) + Headless (4) + Timing (10) | 22 | Allow |
| Bot + datacenter IP | Webdriver (8) + Datacenter (25) | 33 | Challenge |
| Honeypot triggered | Honeypot (25) + Timing (7) | 32 | Challenge |
| Bot farm, all signals | Webdriver (8) + Datacenter (25) + Honeypot (25) + Timing (10) | 68 | **Block** |
| Jailbroken device | Jailbreak (8) + Honeypot flag (25) | 33 | Challenge |

---

## 18. Data Storage and Audit Trail

### Redis (Ephemeral / Cache)

| Key Pattern | Purpose | TTL |
|-------------|---------|-----|
| `hmac:nonce:{nonce}` | Nonce deduplication | 60s |
| `preflight:jti:{jti}` | One-time token tracking | 120s |
| `rl:{endpoint}:{dim}:{value}` | Rate limit sliding window | Varies |
| `risk:velocity:device:{id}` | Request velocity tracking | 120s |
| `pow:{challenge_id}` | PoW challenge storage | 300s |
| `attest:{challenge_id}` | Attestation challenge | 300s |
| `attest:{device_id}` | Attestation state | 86400s |
| `otp:{phone}:{purpose}` | OTP hash + bindings | 180s |
| `otp:cooldown:{phone}:{purpose}` | Resend cooldown | 60s |

### PostgreSQL (Persistent / Audit)

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `devices` | Device registry | device_id, channel, first_seen_at, last_seen_at |
| `otp_requests` | OTP audit trail | phone, challenge_id, device_id, risk_score, status, attempts |
| `sessions` | Active sessions | phone, device_id, access_token_jti, expires_at |
| `audit_log` | Security event log | event_type, phone, device_id, ip_address, risk_score, success |

### Audit Events Logged

| Event Type | When | What Is Recorded |
|-----------|------|-----------------|
| `preflight` | Every preflight request | Device, IP, risk score, channel |
| `otp_send` | Every OTP issuance | Phone, device, IP, risk score, PoW status |
| `otp_verify` | Every verification attempt | Phone, device, IP, success/failure, attempt count |
| `attestation` | Attestation attempts | Device, app_id, success/failure |

---

## 19. Configuration Parameters

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | (required, min 32 chars) | Session JWT signing key |
| `PREFLIGHT_SECRET` | (required, min 32 chars) | Preflight token signing key |
| `REFRESH_TOKEN_SECRET` | (required, min 32 chars) | Refresh token signing key |
| `ATTESTATION_SECRET` | (required, min 32 chars) | Attestation JWT signing key |
| `HMAC_CLIENT_KEY` | (required, min 32 chars) | Shared HMAC signing key |
| `OTP_TTL_SECONDS` | 180 | OTP code validity |
| `OTP_LENGTH` | 6 | OTP digit count |
| `OTP_MAX_VERIFY_ATTEMPTS` | 5 | Max wrong codes before lockout |
| `OTP_RESEND_COOLDOWN_SECONDS` | 60 | Min seconds between sends |
| `OTP_MAX_SENDS_PER_HOUR` | 5 | Max OTPs per phone per hour |
| `PREFLIGHT_TTL_SECONDS` | 120 | Preflight token validity |
| `POW_DIFFICULTY` | 4 | PoW leading zero bits |
| `DEV_MODE` | true | Log OTPs to console (PoC only) |

### Tuning Recommendations for Production

| Parameter | PoC Value | Recommended Production | Rationale |
|-----------|-----------|----------------------|-----------|
| `POW_DIFFICULTY` | 4 | 16-20 | Higher difficulty = more computational cost for attackers |
| `OTP_TTL_SECONDS` | 180 | 120-180 | Shorter = less time for interception |
| `OTP_MAX_SENDS_PER_HOUR` | 5 | 3 | Tighter sends = less SMS cost exposure |
| `PREFLIGHT_TTL_SECONDS` | 120 | 60-90 | Shorter window = harder to exploit |
| `HMAC_TIMESTAMP_DRIFT` | 30s | 10-15s | Tighter = less replay window |
| `DEV_MODE` | true | **false** | Never log OTPs in production |

---

## 20. Acceptance Criteria

### AC-1: HMAC Signing
- [ ] Every `/v1/*` request without valid HMAC headers returns 401
- [ ] Replayed requests (same nonce) are rejected
- [ ] Requests with timestamps older than 30 seconds are rejected
- [ ] Modified request bodies cause signature mismatch

### AC-2: Preflight Token
- [ ] OTP send without preflight token returns 401
- [ ] Expired preflight token (>120s) returns 401
- [ ] Reused preflight token returns 401
- [ ] Preflight token from different IP returns 401

### AC-3: Rate Limiting
- [ ] 6th OTP send to same phone in 1 hour returns 429
- [ ] 429 response includes `retry_after` value
- [ ] Rate limits track independently across all dimensions
- [ ] Limits reset after window expires

### AC-4: Risk Scoring
- [ ] Risk score 0-30 allows request without extra challenges
- [ ] Risk score 31-60 triggers PoW and/or CAPTCHA requirement
- [ ] Risk score 61+ blocks request with 403
- [ ] All 10 risk factors contribute correctly to total score

### AC-5: Proof-of-Work
- [ ] PoW challenge is issued when risk is 31-60
- [ ] Incorrect PoW solution returns 400
- [ ] PoW challenge expires after 5 minutes
- [ ] Each challenge can only be solved once

### AC-6: Device Attestation
- [ ] Mobile requests without attestation JWT are rejected with 401
- [ ] Web requests are not subject to attestation checks
- [ ] Attestation JWT expires after 24 hours
- [ ] Invalid ECDSA signatures are rejected

### AC-7: Fingerprinting
- [ ] Fingerprint is used as rate limit dimension
- [ ] Missing fingerprint adds 5 risk points
- [ ] Fingerprint is logged in audit trail

### AC-8: OTP Binding
- [ ] OTP with wrong device_id fails verification
- [ ] OTP with wrong challenge_id fails verification
- [ ] 6th failed attempt returns 429 OTP_EXHAUSTED
- [ ] OTP after 180 seconds returns 410 OTP_EXPIRED

### AC-9: Honeypot Traps
- [ ] Filled honeypot field adds 25 risk points
- [ ] Honeypot fields are invisible to human users (screen readers, tab order, visual)
- [ ] Mobile jailbreak/root detection triggers equivalent risk

### AC-10: Automation Detection
- [ ] Selenium WebDriver detection adds 8 risk points
- [ ] Headless Chrome detection adds 4 risk points
- [ ] Total automation score capped at 20
- [ ] Jailbreak detection on mobile adds 8 risk points

### AC-11: Timing Analysis
- [ ] Form submitted < 500ms after load = 10 risk points
- [ ] Form submitted < 1500ms after load = 7 risk points
- [ ] Missing timing data = 0 risk points (no penalty)
- [ ] Timestamps from the future are rejected

### AC-CROSS: Cross-Platform
- [ ] Web, iOS, and Flutter produce identical HMAC signatures for same input
- [ ] All platforms send sorted-key JSON bodies
- [ ] All platforms collect and send timing data
- [ ] Flutter Android uses `10.0.2.2:3000` for emulator connectivity
- [ ] Flutter iOS uses `localhost:3000` for simulator connectivity

---

## 21. Glossary

| Term | Definition |
|------|-----------|
| **argon2id** | Memory-hard password/OTP hashing algorithm recommended by OWASP. Resistant to GPU-based brute-force attacks. |
| **CAPTCHA** | Challenge-response test to differentiate humans from bots. Stubbed in PoC. |
| **E.164** | International phone number format: `+` followed by 7-15 digits (e.g., `+14155551234`). |
| **ECDSA** | Elliptic Curve Digital Signature Algorithm. Used with P-256 curve for device attestation. |
| **HMAC** | Hash-based Message Authentication Code. Proves message integrity and sender authenticity. |
| **JTI** | JWT ID — unique identifier for a token, used to prevent reuse. |
| **Leading Zero Bits** | PoW technique: find input whose SHA256 hash starts with N zero bits. Difficulty doubles per additional bit. |
| **Nonce** | "Number used once" — prevents replay attacks by ensuring each request is unique. |
| **PoW** | Proof-of-Work — computational puzzle that costs CPU time to solve. |
| **P-256** | NIST-standardized elliptic curve (also called `prime256v1` or `secp256r1`). |
| **Risk Score** | 0-100 integer summarizing the likelihood that a request is automated or malicious. |
| **Sliding Window** | Rate limiting technique where the time window moves forward continuously rather than resetting at fixed intervals. |
| **SPKI** | Subject Public Key Info — ASN.1 structure for encoding public keys in standard format. |
| **TTL** | Time to Live — duration before a token, challenge, or cached value expires. |

---

*This document describes a Proof of Concept implementation. Production deployment requires additional considerations including: real SMS provider integration, Apple App Attest / Google Play Integrity for hardware attestation, production CAPTCHA service (e.g., reCAPTCHA, hCaptcha), TLS enforcement, secret rotation procedures, monitoring/alerting, and incident response playbooks.*
