/**
 * Legitimate Flow Script
 *
 * Performs the full happy-path OTP authentication:
 * 1. Preflight -> get token
 * 2. Send OTP -> get challenge_id
 * 3. Read OTP from console output (dev mode) or prompt
 * 4. Verify OTP -> get session tokens
 * 5. Fetch session/me
 *
 * In DEV_MODE, the backend logs the OTP to console.
 * This script uses a fixed test OTP that we'll read from stdin.
 */
import crypto from 'node:crypto';
import readline from 'node:readline';
import { apiCall, green, red, yellow, bold } from './helpers.js';

const PHONE = '+15551234567';
const DEVICE_ID = `legit-${crypto.randomUUID().slice(0, 8)}`;

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

console.log(bold('\n=== Legitimate OTP Flow ===\n'));
console.log(`Phone: ${PHONE}`);
console.log(`Device: ${DEVICE_ID}`);

// Step 1: Preflight
console.log(bold('\n--- Step 1: Preflight ---'));
const now = Date.now();
const pfResult = await apiCall('POST', '/v1/auth/preflight', {
  channel: 'web',
  device_id: DEVICE_ID,
  fingerprint: {
    userAgent: 'OTPPoc-LegitScript/1.0',
    acceptLanguage: 'en-US',
    timezone: 'America/New_York',
    screen: '1920x1080x24',
    cookieId: crypto.randomUUID(),
  },
  client_signals: {
    timing: {
      page_load_ts: now - 5000,
      first_interaction_ts: now - 3000,
      form_submit_ts: now,
    },
  },
}, { 'X-Device-Id': DEVICE_ID });

if (pfResult.status !== 200) {
  console.log(red(`FAIL: Preflight returned ${pfResult.status}: ${JSON.stringify(pfResult.data.error)}`));
  process.exit(1);
}

const preflightToken = pfResult.data.data.token;
const riskScore = pfResult.data.data.risk_score;
console.log(green(`Preflight OK. Risk score: ${riskScore}`));
console.log(`Session ID: ${pfResult.data.data.session_id}`);

// Step 2: Send OTP
console.log(bold('\n--- Step 2: Send OTP ---'));

const sendOpts: Record<string, unknown> = {
  phone: PHONE,
  purpose: 'login',
};

// If risk > 30, we need PoW + CAPTCHA
if (pfResult.data.data.requires_pow && pfResult.data.data.pow_challenge) {
  console.log(yellow('PoW required, solving...'));
  const { nonce, difficulty, challenge_id } = pfResult.data.data.pow_challenge;

  // Solve PoW
  let counter = 0;
  while (true) {
    const candidate = `${nonce}${counter}`;
    const hash = crypto.createHash('sha256').update(candidate).digest('hex');
    const zeroBits = countLeadingZeroBits(hash);
    if (zeroBits >= difficulty) {
      sendOpts.pow_solution = { nonce, solution: counter.toString(), challenge_id };
      console.log(green(`PoW solved! Counter: ${counter}`));
      break;
    }
    counter++;
  }

  sendOpts.captcha_token = 'pass'; // stub
}

const sendResult = await apiCall('POST', '/v1/auth/otp/send', sendOpts, {
  'X-Preflight-Token': preflightToken,
  'X-Device-Id': DEVICE_ID,
});

if (sendResult.status !== 200) {
  console.log(red(`FAIL: OTP send returned ${sendResult.status}: ${JSON.stringify(sendResult.data.error)}`));
  process.exit(1);
}

const challengeId = sendResult.data.data.challenge_id;
console.log(green('OTP sent successfully!'));
console.log(`Challenge ID: ${challengeId}`);
console.log(yellow('\nCheck backend console (docker compose logs backend) for the OTP code.\n'));

// Step 3: Get OTP from user
const otpCode = await prompt('Enter OTP code from backend console: ');

// Step 4: Verify OTP
console.log(bold('\n--- Step 3: Verify OTP ---'));
const verifyResult = await apiCall('POST', '/v1/auth/otp/verify', {
  phone: PHONE,
  code: otpCode,
  challenge_id: challengeId,
  device_id: DEVICE_ID,
}, { 'X-Device-Id': DEVICE_ID });

if (verifyResult.status !== 200) {
  console.log(red(`FAIL: OTP verify returned ${verifyResult.status}: ${JSON.stringify(verifyResult.data.error)}`));
  process.exit(1);
}

const accessToken = verifyResult.data.data.access_token;
console.log(green('OTP verified! Session created.'));
console.log(`Token type: ${verifyResult.data.data.token_type}`);
console.log(`Expires in: ${verifyResult.data.data.expires_in}s`);

// Step 5: Fetch session
console.log(bold('\n--- Step 4: Session Info ---'));
const sessionResult = await apiCall('GET', '/v1/auth/session/me', undefined, {
  'Authorization': `Bearer ${accessToken}`,
  'X-Device-Id': DEVICE_ID,
});

if (sessionResult.status !== 200) {
  console.log(red(`FAIL: Session/me returned ${sessionResult.status}: ${JSON.stringify(sessionResult.data.error)}`));
  process.exit(1);
}

console.log(green('Session retrieved:'));
console.log(JSON.stringify(sessionResult.data.data, null, 2));

console.log(bold(green('\n=== FULL LEGITIMATE FLOW PASSED ===\n')));

function countLeadingZeroBits(hexHash: string): number {
  let bits = 0;
  for (const char of hexHash) {
    const nibble = parseInt(char, 16);
    if (nibble === 0) {
      bits += 4;
    } else {
      // Count leading zeros in this nibble
      for (let i = 3; i >= 0; i--) {
        if ((nibble >> i) & 1) return bits;
        bits++;
      }
    }
  }
  return bits;
}
