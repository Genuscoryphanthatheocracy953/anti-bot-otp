import { describe, it, expect } from 'vitest';
import { extractIp, extractSubnet, isDatacenterIp } from '../../src/utils/ip.js';

describe('IP utilities', () => {
  describe('extractIp', () => {
    it('extracts from X-Forwarded-For header', () => {
      const ip = extractIp({
        ip: '172.17.0.1',
        headers: { 'x-forwarded-for': '203.0.113.50, 70.41.3.18' },
      });
      expect(ip).toBe('203.0.113.50');
    });

    it('uses first IP from comma-separated list', () => {
      const ip = extractIp({
        ip: '172.17.0.1',
        headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8, 9.10.11.12' },
      });
      expect(ip).toBe('1.2.3.4');
    });

    it('falls back to request.ip', () => {
      const ip = extractIp({
        ip: '192.168.1.100',
        headers: {},
      });
      expect(ip).toBe('192.168.1.100');
    });

    it('falls back to 127.0.0.1 if no IP', () => {
      const ip = extractIp({
        ip: '',
        headers: {},
      });
      expect(ip).toBe('127.0.0.1');
    });

    it('trims whitespace from forwarded header', () => {
      const ip = extractIp({
        ip: '0.0.0.0',
        headers: { 'x-forwarded-for': '  10.0.0.1  ' },
      });
      expect(ip).toBe('10.0.0.1');
    });

    it('ignores non-string x-forwarded-for', () => {
      const ip = extractIp({
        ip: '192.168.1.1',
        headers: { 'x-forwarded-for': ['10.0.0.1'] },
      });
      expect(ip).toBe('192.168.1.1');
    });
  });

  describe('extractSubnet', () => {
    it('extracts /24 subnet for IPv4', () => {
      expect(extractSubnet('192.168.1.100')).toBe('192.168.1.0/24');
    });

    it('zeros out last octet', () => {
      expect(extractSubnet('10.0.5.255')).toBe('10.0.5.0/24');
    });

    it('returns original for non-IPv4', () => {
      const ipv6 = '::1';
      expect(extractSubnet(ipv6)).toBe(ipv6);
    });
  });

  describe('isDatacenterIp', () => {
    it('detects private range 10.x.x.x', () => {
      expect(isDatacenterIp('10.0.0.1')).toBe(true);
      expect(isDatacenterIp('10.255.255.255')).toBe(true);
    });

    it('detects TEST-NET-2 (198.51.100.x)', () => {
      expect(isDatacenterIp('198.51.100.1')).toBe(true);
      expect(isDatacenterIp('198.51.100.254')).toBe(true);
    });

    it('detects TEST-NET-3 (203.0.113.x)', () => {
      expect(isDatacenterIp('203.0.113.1')).toBe(true);
    });

    it('detects DigitalOcean range', () => {
      expect(isDatacenterIp('134.209.100.50')).toBe(true);
    });

    it('detects AWS range', () => {
      expect(isDatacenterIp('52.1.2.3')).toBe(true);
    });

    it('detects GCP range', () => {
      expect(isDatacenterIp('35.200.1.1')).toBe(true);
    });

    it('does not flag residential IPs', () => {
      expect(isDatacenterIp('86.45.123.10')).toBe(false);
      expect(isDatacenterIp('176.12.34.56')).toBe(false);
    });

    it('does not flag localhost', () => {
      expect(isDatacenterIp('127.0.0.1')).toBe(false);
    });

    it('handles invalid IP gracefully', () => {
      expect(isDatacenterIp('not-an-ip')).toBe(false);
    });
  });
});
