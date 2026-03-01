/**
 * Abuse Script: Rate limit testing
 *
 * Sends rapid-fire preflight + OTP send requests for the same phone number.
 * Expected: First few succeed, then 429 RATE_LIMITED with Retry-After header.
 * The per-phone limit is 5/hour, so request #6 should be blocked.
 */
import crypto from 'node:crypto';
import { apiCall, green, red, yellow, bold, hmacSign, sha256 } from './helpers.js';

const HMAC_KEY = process.env.HMAC_CLIENT_KEY || 'change_me_hmac_client_key_at_least_32_chars_long';
const PHONE = '+15559876543';
const DEVICE_ID = `ratelimit-test-${crypto.randomUUID().slice(0, 8)}`;

console.log(bold('\n=== Test: Rate Limit Enforcement ===\n'));
console.log(`Phone: ${PHONE}`);
console.log(`Device: ${DEVICE_ID}`);
console.log('');

let rateLimited = false;

for (let i = 1; i <= 10; i++) {
  // Step 1: Get preflight
  const pfResult = await apiCall('POST', '/v1/auth/preflight', {
    channel: 'web',
    device_id: DEVICE_ID,
  }, { 'X-Device-Id': DEVICE_ID });

  if (pfResult.status !== 200) {
    if (pfResult.status === 429) {
      console.log(yellow(`Request ${i}: RATE LIMITED at preflight (Retry-After: ${pfResult.data.error?.retry_after}s)`));
      rateLimited = true;
      continue;
    }
    console.log(red(`Request ${i}: Preflight failed with ${pfResult.status}: ${JSON.stringify(pfResult.data.error)}`));
    continue;
  }

  const token = pfResult.data.data?.token;
  if (!token) {
    console.log(red(`Request ${i}: No preflight token`));
    continue;
  }

  // Step 2: Send OTP
  const sendResult = await apiCall('POST', '/v1/auth/otp/send', {
    phone: PHONE,
    purpose: 'login',
  }, {
    'X-Preflight-Token': token,
    'X-Device-Id': DEVICE_ID,
  });

  if (sendResult.status === 429) {
    const retryAfter = sendResult.data.error?.retry_after;
    console.log(yellow(`Request ${i}: RATE LIMITED (Retry-After: ${retryAfter}s)`));
    rateLimited = true;
  } else if (sendResult.status === 200) {
    console.log(`Request ${i}: OTP sent (challenge: ${sendResult.data.data?.challenge_id?.slice(0, 8)}...)`);
  } else {
    console.log(`Request ${i}: HTTP ${sendResult.status} - ${sendResult.data.error?.code}: ${sendResult.data.error?.message}`);
  }

  // Small delay to let Redis process
  await new Promise(r => setTimeout(r, 100));
}

console.log('');
if (rateLimited) {
  console.log(green('PASS: Rate limiting triggered as expected'));
} else {
  console.log(red('FAIL: All 10 requests succeeded — rate limiting not enforced'));
  process.exit(1);
}
