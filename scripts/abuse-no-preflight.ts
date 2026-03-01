/**
 * Abuse Script: OTP send without preflight token
 *
 * Tests that POST /v1/auth/otp/send is rejected when no preflight token is provided.
 * Expected: 401 PREFLIGHT_REQUIRED
 */
import { apiCall, green, red, bold } from './helpers.js';

console.log(bold('\n=== Test: OTP Send Without Preflight ===\n'));

const { status, data } = await apiCall('POST', '/v1/auth/otp/send', {
  phone: '+15551234567',
  purpose: 'login',
});

console.log(`HTTP Status: ${status}`);
console.log(`Response:`, JSON.stringify(data, null, 2));

if (status === 401 && data.error?.code === 'PREFLIGHT_REQUIRED') {
  console.log(green('\nPASS: Correctly rejected with 401 PREFLIGHT_REQUIRED'));
} else {
  console.log(red('\nFAIL: Expected 401 PREFLIGHT_REQUIRED, got ' + status + ' ' + data.error?.code));
  process.exit(1);
}
