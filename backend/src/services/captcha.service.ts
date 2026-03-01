/**
 * CAPTCHA Stub Service
 *
 * In production, replace with Cloudflare Turnstile, hCaptcha, or reCAPTCHA v3.
 * For this PoC, only the token "pass" is accepted.
 */
export function verifyCaptchaToken(token: string): boolean {
  return token === 'pass';
}
