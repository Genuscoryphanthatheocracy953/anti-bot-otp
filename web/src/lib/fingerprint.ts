export interface Fingerprint {
  userAgent: string;
  acceptLanguage: string;
  timezone: string;
  screen: string;
  cookieId: string;
}

function getOrCreateCookieId(): string {
  const key = 'otppoc_cid';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export function collectFingerprint(): Fingerprint {
  return {
    userAgent: navigator.userAgent,
    acceptLanguage: navigator.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}x${screen.height}x${screen.colorDepth}`,
    cookieId: getOrCreateCookieId(),
  };
}

export async function hashFingerprint(fp: Fingerprint): Promise<string> {
  const raw = [fp.userAgent, fp.acceptLanguage, fp.timezone, fp.screen, fp.cookieId].join('|');
  const encoder = new TextEncoder();
  const data = encoder.encode(raw);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}
