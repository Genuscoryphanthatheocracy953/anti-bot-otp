# CLAUDE.md — Project Context for Claude Code

## Project Overview

OTP Authentication Proof-of-Concept with 11 layered anti-bot defense mechanisms. Monorepo with five components: Fastify backend, Next.js web frontend, native iOS (SwiftUI) app, native Android (Kotlin + Jetpack Compose) app, and cross-platform Flutter app.

## Repository Structure

```
otppoc/
├── backend/          # Fastify 5 + TypeScript (port 3000)
├── web/              # Next.js 15 + React 19 (port 3001)
├── android/          # Native Kotlin + Jetpack Compose Android app
├── ios/OTPPoc/       # Native SwiftUI iOS app
├── flutter/          # Cross-platform Flutter app (iOS + Android)
├── scripts/          # Abuse simulation scripts (tsx)
├── infra/            # Docker configs (postgres, redis)
├── docs/             # Product specs
├── docker-compose.yml
├── Makefile
└── STATE_MACHINE.md
```

## Quick Commands

### Backend
```bash
cd backend && npm run dev          # Start with hot reload (tsx watch)
cd backend && npm test             # Run 252+ vitest tests
cd backend && npm run build        # TypeScript compile
```

### Web
```bash
cd web && npm run dev              # Next.js dev server on :3001
```

### Android
```bash
cd android && ./gradlew assembleDebug    # Build debug APK
cd android && ./gradlew installDebug     # Install on emulator/device
```

### Flutter
```bash
cd flutter && flutter run          # Run on connected device/simulator
cd flutter && flutter test         # Run 60 unit/widget tests
cd flutter && flutter analyze      # Dart static analysis
```

### iOS
```bash
make build-ios                     # Build for simulator
# Or open ios/OTPPoc/OTPPoc.xcodeproj in Xcode
```

### Docker (full stack)
```bash
make up                            # Start all services (postgres, redis, backend, web)
make down                          # Stop all services
make logs                          # Tail all logs
make clean                         # Remove volumes and node_modules
```

### Abuse Testing
```bash
cd scripts && npx tsx abuse-no-preflight.ts       # Expect 401
cd scripts && npx tsx abuse-rate-limit.ts         # Expect 429
cd scripts && npx tsx abuse-invalid-challenges.ts # Expect 400/401
cd scripts && npx tsx legitimate-flow.ts          # Full happy path
```

## Tech Stack & Versions

| Component | Stack | Key Dependencies |
|-----------|-------|-----------------|
| Backend | Fastify 5, TypeScript 5.6, Node 22+ | argon2 0.41, ioredis 5.4, pg 8.13, jsonwebtoken 9, zod 3.23 |
| Web | Next.js 15, React 19, TypeScript 5.9 | Zero external deps (Web Crypto API) |
| iOS | SwiftUI, Swift 5.10, iOS 17+ | Zero external deps (CryptoKit, Security) |
| Android | Kotlin 1.9, Jetpack Compose, AGP 8.3 | OkHttp 4.12, Gson 2.10, security-crypto 1.1.0-alpha06 |
| Flutter | Dart 3.6+, Flutter SDK | http 1.2, crypto 3.0, pointycastle 3.9, asn1lib 1.5, provider 6.1, flutter_secure_storage 9.2 |
| Infra | PostgreSQL 16, Redis 7, Docker | |

## Database

**PostgreSQL tables** (migration: `backend/src/db/migrations/001_initial.sql`):
- `otp_requests` — OTP storage with argon2id hash, challenge binding, attempt tracking
- `sessions` — JWT sessions with device binding
- `devices` — Device registry with attestation hash
- `audit_log` — Event audit trail with JSONB metadata

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | `/v1/auth/preflight` | HMAC | Get preflight token + risk score |
| POST | `/v1/auth/otp/send` | HMAC + Preflight + Attestation(mobile) | Send OTP |
| POST | `/v1/auth/otp/verify` | HMAC | Verify OTP, get JWT tokens |
| GET | `/v1/auth/session/me` | HMAC + Bearer | Get session info |
| POST | `/v1/challenge/pow/issue` | HMAC | Get PoW challenge |
| POST | `/v1/challenge/pow/verify` | HMAC | Submit PoW solution |
| POST | `/v1/challenge/captcha/verify` | HMAC | Verify CAPTCHA (stub: token="pass") |
| POST | `/v1/device/attest` | HMAC | Get attestation challenge |
| POST | `/v1/device/attest/verify` | HMAC | Verify attestation |
| GET | `/health` | None | Health check |

## Key Patterns & Conventions

### Backend
- **Middleware chain order**: requestContext → hmacVerify → rateLimiter → route-specific guards
- **HMAC signature**: `HMAC-SHA256(METHOD\nPATH\nTIMESTAMP\nSHA256(BODY))`
- **Timestamp drift tolerance**: ±30 seconds
- **Nonce dedup**: Redis TTL 60 seconds
- **Rate limiting**: Lua-based sliding window on sorted sets, multi-dimensional (IP, /24 subnet, device, phone, fingerprint)
- **Risk scoring**: 10-factor algorithm, 0-100 scale. Thresholds: ≤30 pass, 31-60 PoW+CAPTCHA, >60 block
- **OTP hashing**: argon2id at rest
- **JSON key ordering**: All clients sort keys alphabetically (SplayTreeMap in Dart, sorted Object.keys in JS/TS) for deterministic HMAC body hash

### Web Frontend
- **Styling**: Inline CSS-in-JS (no Tailwind/CSS framework)
- **State**: Single `useAuthFlow` custom hook with `useState`/`useCallback`/`useRef`
- **Crypto**: Web Crypto API (SubtleCrypto) — no external crypto library
- **Honeypot**: 3 hidden fields (name, email, url) at `left: -9999px`
- **PoW solver**: Yields every 10,000 iterations to prevent UI blocking

### iOS
- **Architecture**: MVVM with `@Published`/`@MainActor`
- **Storage**: Keychain via Security framework
- **Crypto**: CryptoKit P256 for attestation, SHA256 for PoW/HMAC
- **No external dependencies** — pure Apple frameworks

### Android
- **Architecture**: MVVM with `AndroidViewModel` + `StateFlow` (Jetpack Compose)
- **Storage**: `EncryptedSharedPreferences` via security-crypto
- **Crypto**: `java.security.KeyPairGenerator("EC")` with secp256r1 for attestation, `javax.crypto.Mac` for HMAC, `java.security.MessageDigest` for SHA256
- **Networking**: OkHttp + Gson with recursive `TreeMap` sorted-key serialization
- **PoW**: Runs on `Dispatchers.Default` coroutine
- **Base URL**: `http://10.0.2.2:3000` (emulator gateway to host)
- **EC key format**: `PublicKey.encoded` = SPKI natively, `Signature("SHA256withECDSA")` = DER natively
- **Integrity checks**: Root detection (14 paths + test-keys), Frida port 27042, `/proc/self/maps` scanning

### Flutter
- **State management**: Provider + ChangeNotifier
- **Storage**: flutter_secure_storage (Keychain iOS / Keystore Android)
- **Crypto**: pointycastle (P256 ECDSA), crypto (SHA256/HMAC), asn1lib (DER encoding)
- **PoW**: Runs on background Isolate via `Isolate.run()`
- **Android networking**: Uses `10.0.2.2:3000` (emulator gateway), iOS uses `localhost:3000`
- **Attestation key format**: SPKI (91 bytes: 26-byte ASN.1 header + 65-byte uncompressed point)
- **ECDSASigner init**: Requires `HMac(SHA256Digest(), 64)` as MAC param + `ParametersWithRandom`

## Environment Variables

See `.env.example`. Key variables:
- `HMAC_CLIENT_KEY` — Shared HMAC signing key (min 32 chars), hardcoded in all clients
- `JWT_SECRET`, `PREFLIGHT_SECRET`, `REFRESH_TOKEN_SECRET`, `ATTESTATION_SECRET` — Token signing keys
- `DEV_MODE=true` — Logs OTP codes to console instead of sending via Telegram
- `POW_DIFFICULTY=4` — Leading zero bits required (default)
- `TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID` — OTP delivery (optional in dev)

## Redis Key Prefixes

`rl:*` (rate limits), `otp:*` (OTP data), `otp:cooldown:*`, `preflight:jti:*`, `pow:*`, `hmac:nonce:*`, `risk:velocity:*`, `risk:fail:*`, `device:phones:*`, `attest:*`, `session:revoked:*`

## Known Gotchas

1. **HMAC body hash mismatch**: Clients MUST sort JSON keys alphabetically before hashing. The backend verifies the hash of the raw request body bytes.
2. **Flutter pointycastle**: `ECDSASigner` needs `HMac(SHA256Digest(), 64)` — passing `null` causes `RegistryFactoryException`.
3. **Backend returns Unix timestamps as `int`**: Flutter/web models must parse `expires_at`/`issued_at` as numbers, not strings.
4. **Android emulator**: Cannot use `localhost` — must use `10.0.2.2` to reach host machine.
5. **Docker vs local dev**: Docker uses hostnames `postgres`/`redis`; local dev uses `localhost`. Create a local `.env` with `POSTGRES_HOST=localhost` and `REDIS_HOST=localhost`.
6. **Database migration**: Run `001_initial.sql` manually for local dev (Docker auto-runs it via init scripts).
7. **`requires_pow`/`requires_captcha`**: May be absent from preflight response — clients must default to `false`.
8. **Android HMAC key encoding**: The hex string key is used as raw UTF-8 bytes, NOT hex-decoded — same as all other clients.
9. **Android sorted JSON**: Must use recursive `TreeMap` conversion before Gson serialization for deterministic body hash.
10. **Android network security**: Requires `network_security_config.xml` to allow cleartext traffic to `10.0.2.2` and `localhost` for dev.

## Testing

- **Backend**: 252+ tests across 20 suites (vitest). Covers all middleware, services, utilities, and config.
- **Flutter**: 60 tests across 7 files. Covers models, HMAC signing, PoW solving, phone formatting, widgets.
- **iOS**: No unit tests (SwiftUI preview-based development).
- **Web**: No frontend tests (hook-based logic tested via backend integration).
- **Abuse scripts**: 3 attack simulations + 1 legitimate flow script.
