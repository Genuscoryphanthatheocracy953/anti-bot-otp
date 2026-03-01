import { DATACENTER_CIDRS } from '../config/constants.js';

export function extractIp(request: { ip: string; headers: Record<string, string | string[] | undefined> }): string {
  const forwarded = request.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return request.ip || '127.0.0.1';
}

export function extractSubnet(ip: string): string {
  // Extract /24 subnet for IPv4
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.${parts[2]}.0/24`;
  }
  // For IPv6, use /48
  return ip;
}

export function isDatacenterIp(ip: string): boolean {
  return DATACENTER_CIDRS.some((cidr) => ipInCidr(ip, cidr));
}

function ipInCidr(ip: string, cidr: string): boolean {
  const [range, bits] = cidr.split('/');
  const mask = parseInt(bits, 10);

  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(range);

  if (ipNum === null || rangeNum === null) return false;

  const maskBits = ~((1 << (32 - mask)) - 1) >>> 0;
  return (ipNum & maskBits) === (rangeNum & maskBits);
}

function ipToNumber(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;

  let num = 0;
  for (const part of parts) {
    const octet = parseInt(part, 10);
    if (isNaN(octet) || octet < 0 || octet > 255) return null;
    num = (num << 8) + octet;
  }
  return num >>> 0;
}
