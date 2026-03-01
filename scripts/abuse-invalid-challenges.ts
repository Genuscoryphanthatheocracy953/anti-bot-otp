/**
 * Abuse Script: Invalid PoW, CAPTCHA, and Attestation
 *
 * Tests that the backend correctly rejects:
 * 1. Invalid proof-of-work solutions
 * 2. Invalid CAPTCHA tokens
 * 3. Forged attestation JWTs
 */
import { apiCall, green, red, bold } from './helpers.js';

let passed = 0;
let failed = 0;

// --- Test 1: Invalid PoW ---
console.log(bold('\n=== Test 1: Invalid Proof-of-Work ===\n'));

// Issue a real challenge
const powIssue = await apiCall('POST', '/v1/challenge/pow/issue', {
  device_id: 'test-device-pow',
});

if (powIssue.status === 200 && powIssue.data.data?.nonce) {
  const nonce = powIssue.data.data.nonce;
  const challengeId = powIssue.data.data.challenge_id;

  // Submit wrong solution
  const powVerify = await apiCall('POST', '/v1/challenge/pow/verify', {
    nonce,
    solution: '9999999',
    challenge_id: challengeId,
  });

  console.log(`Status: ${powVerify.status}, Code: ${powVerify.data.error?.code}`);
  if (powVerify.status === 400 && powVerify.data.error?.code === 'INVALID_POW') {
    console.log(green('PASS: Invalid PoW correctly rejected'));
    passed++;
  } else {
    console.log(red('FAIL: Expected 400 INVALID_POW'));
    failed++;
  }
} else {
  console.log(red('FAIL: Could not issue PoW challenge'));
  failed++;
}

// --- Test 2: Invalid CAPTCHA ---
console.log(bold('\n=== Test 2: Invalid CAPTCHA Token ===\n'));

const captchaResult = await apiCall('POST', '/v1/challenge/captcha/verify', {
  token: 'invalid_token_should_fail',
});

console.log(`Status: ${captchaResult.status}, Code: ${captchaResult.data.error?.code}`);
if (captchaResult.status === 400 && captchaResult.data.error?.code === 'INVALID_CAPTCHA') {
  console.log(green('PASS: Invalid CAPTCHA correctly rejected'));
  passed++;
} else {
  console.log(red('FAIL: Expected 400 INVALID_CAPTCHA'));
  failed++;
}

// Test valid CAPTCHA (stub: "pass")
const captchaValid = await apiCall('POST', '/v1/challenge/captcha/verify', {
  token: 'pass',
});

if (captchaValid.status === 200 && captchaValid.data.data?.verified) {
  console.log(green('PASS: Valid CAPTCHA token "pass" accepted'));
  passed++;
} else {
  console.log(red('FAIL: Expected valid CAPTCHA to pass'));
  failed++;
}

// --- Test 3: Forged Attestation JWT ---
console.log(bold('\n=== Test 3: Forged Attestation JWT ===\n'));

const forgedJwt = 'eyJhbGciOiJIUzI1NiJ9.eyJkZXZpY2VfaWQiOiJmYWtlIiwiYXBwX2lkIjoiZmFrZSIsInR5cGUiOiJhdHRlc3RhdGlvbiJ9.forged_signature';

const attestResult = await apiCall('POST', '/v1/auth/otp/send', {
  phone: '+15551112222',
  purpose: 'login',
}, {
  'X-Channel': 'mobile',
  'X-Attestation-Token': forgedJwt,
  'X-Device-Id': 'forged-device',
});

console.log(`Status: ${attestResult.status}, Code: ${attestResult.data.error?.code}`);
// Could be ATTESTATION_REQUIRED or PREFLIGHT_REQUIRED (since no preflight either)
if (attestResult.status === 401) {
  console.log(green('PASS: Forged attestation correctly rejected with 401'));
  passed++;
} else {
  console.log(red(`FAIL: Expected 401, got ${attestResult.status}`));
  failed++;
}

// --- Summary ---
console.log(bold(`\n=== Summary: ${passed} passed, ${failed} failed ===\n`));
if (failed > 0) process.exit(1);
