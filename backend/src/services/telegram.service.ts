import { env } from '../config/env.js';
import { maskPhone } from '../utils/phone.js';

export async function sendOtpViaTelegram(params: {
  phone: string;
  otp: string;
  challengeId: string;
  expiresAt: number;
}): Promise<void> {
  const { phone, otp, challengeId, expiresAt } = params;
  const expiresDate = new Date(expiresAt * 1000).toISOString();

  const message = [
    `🔐 OTP for ${maskPhone(phone)}`,
    `Code: ${otp}`,
    `Challenge: ${challengeId}`,
    `Expires: ${expiresDate}`,
  ].join('\n');

  // Dev mode: always log to console
  if (env.DEV_MODE) {
    console.log('\n========== OTP (DEV MODE) ==========');
    console.log(`Phone: ${phone}`);
    console.log(`OTP: ${otp}`);
    console.log(`Challenge ID: ${challengeId}`);
    console.log(`Expires: ${expiresDate}`);
    console.log('=====================================\n');
  }

  // Send via Telegram if configured
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: env.TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'HTML',
        }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Telegram send failed:', text);
      }
    } catch (err) {
      console.error('Telegram send error:', err);
      // Don't throw — OTP was generated, delivery failure is non-fatal in dev
    }
  }
}
