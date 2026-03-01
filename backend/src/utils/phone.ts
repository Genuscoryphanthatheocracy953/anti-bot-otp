const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export function normalizePhone(phone: string): string {
  // Strip spaces, dashes, parens
  let cleaned = phone.replace(/[\s\-\(\)]/g, '');

  // Ensure leading +
  if (!cleaned.startsWith('+')) {
    cleaned = '+' + cleaned;
  }

  return cleaned;
}

export function validateE164(phone: string): boolean {
  return E164_REGEX.test(phone);
}

export function maskPhone(phone: string): string {
  if (phone.length < 6) return '***';
  return phone.slice(0, 4) + '****' + phone.slice(-2);
}
