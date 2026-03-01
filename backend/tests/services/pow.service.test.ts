import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockRedis, MockRedis } from '../helpers/mock-redis.js';
import { sha256 } from '../../src/utils/crypto.js';

vi.mock('../../src/config/env.js', () => ({
  env: {
    POW_DIFFICULTY: 4,
  },
}));

import { issueChallenge, verifySolution } from '../../src/services/pow.service.js';

describe('PoW service', () => {
  let redis: MockRedis;

  beforeEach(() => {
    redis = createMockRedis();
  });

  describe('issueChallenge', () => {
    it('returns challenge with all required fields', async () => {
      const challenge = await issueChallenge(redis as any, 'device-1');

      expect(challenge.nonce).toBeTruthy();
      expect(challenge.difficulty).toBe(4);
      expect(challenge.challenge_id).toBeTruthy();
      expect(challenge.device_id).toBe('device-1');
      expect(challenge.created_at).toBeGreaterThan(0);
    });

    it('stores challenge in Redis with 300s TTL', async () => {
      const challenge = await issueChallenge(redis as any, 'device-1');

      expect(redis.set).toHaveBeenCalledWith(
        expect.stringContaining(challenge.challenge_id),
        expect.any(String),
        'EX',
        300,
      );
    });

    it('allows custom difficulty', async () => {
      const challenge = await issueChallenge(redis as any, 'device-1', 8);
      expect(challenge.difficulty).toBe(8);
    });

    it('generates unique challenge IDs', async () => {
      const c1 = await issueChallenge(redis as any, 'device-1');
      const c2 = await issueChallenge(redis as any, 'device-1');
      expect(c1.challenge_id).not.toBe(c2.challenge_id);
    });

    it('generates unique nonces', async () => {
      const c1 = await issueChallenge(redis as any, 'device-1');
      const c2 = await issueChallenge(redis as any, 'device-1');
      expect(c1.nonce).not.toBe(c2.nonce);
    });
  });

  describe('verifySolution', () => {
    it('rejects solution for expired/missing challenge', async () => {
      redis.get.mockResolvedValueOnce(null);

      const valid = await verifySolution(redis as any, {
        nonce: 'abc',
        solution: 'def',
        challenge_id: 'nonexistent',
      });

      expect(valid).toBe(false);
    });

    it('rejects solution with wrong nonce', async () => {
      const challenge = await issueChallenge(redis as any, 'device-1');

      // Mock getting the stored challenge back
      const storedCall = redis.set.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes(challenge.challenge_id),
      );
      redis.get.mockResolvedValueOnce(storedCall![1] as string);

      const valid = await verifySolution(redis as any, {
        nonce: 'wrong-nonce',
        solution: '12345',
        challenge_id: challenge.challenge_id,
      });

      expect(valid).toBe(false);
    });

    it('accepts valid solution with correct leading zeros', async () => {
      // Create a challenge with difficulty 1 (easy to brute-force in test)
      const challenge = await issueChallenge(redis as any, 'device-1', 1);

      const storedCall = redis.set.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes(challenge.challenge_id),
      );
      redis.get.mockResolvedValueOnce(storedCall![1] as string);

      // Brute force a valid solution (difficulty=1 means first hex char is 0 => first 4 bits are zero)
      let solution = '';
      for (let i = 0; i < 1_000_000; i++) {
        const hash = sha256(challenge.nonce + i.toString());
        // difficulty 1: first hex char needs to contribute to 1 leading zero bit
        // Actually difficulty is in bits. 1 bit = first nibble < 8
        // For hasLeadingZeroBits with 1 bit: (nibble & 0x8) === 0
        const nibble = parseInt(hash[0], 16);
        if ((nibble & 0x8) === 0) {
          solution = i.toString();
          break;
        }
      }

      expect(solution).toBeTruthy();
      const valid = await verifySolution(redis as any, {
        nonce: challenge.nonce,
        solution,
        challenge_id: challenge.challenge_id,
      });

      expect(valid).toBe(true);
    });

    it('consumes challenge after valid solution (one-time use)', async () => {
      const challenge = await issueChallenge(redis as any, 'device-1', 1);

      const storedCall = redis.set.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes(challenge.challenge_id),
      );
      redis.get.mockResolvedValueOnce(storedCall![1] as string);

      // Find valid solution
      let solution = '';
      for (let i = 0; i < 1_000_000; i++) {
        const hash = sha256(challenge.nonce + i.toString());
        const nibble = parseInt(hash[0], 16);
        if ((nibble & 0x8) === 0) {
          solution = i.toString();
          break;
        }
      }

      await verifySolution(redis as any, {
        nonce: challenge.nonce,
        solution,
        challenge_id: challenge.challenge_id,
      });

      // Should delete the challenge
      expect(redis.del).toHaveBeenCalledWith(
        expect.stringContaining(challenge.challenge_id),
      );
    });

    it('does NOT delete challenge for invalid solution', async () => {
      const challenge = await issueChallenge(redis as any, 'device-1', 20); // Very hard

      const storedCall = redis.set.mock.calls.find(
        (call) => typeof call[0] === 'string' && call[0].includes(challenge.challenge_id),
      );
      redis.get.mockResolvedValueOnce(storedCall![1] as string);

      const valid = await verifySolution(redis as any, {
        nonce: challenge.nonce,
        solution: 'definitely_wrong',
        challenge_id: challenge.challenge_id,
      });

      expect(valid).toBe(false);
      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});
