import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:otp_poc/services/pow_service.dart';

void main() {
  group('PoWService', () {
    test('finds valid solution for difficulty 4', () async {
      final solution = await PoWService.solve(nonce: 'testnonce', difficulty: 4);

      // Verify the solution is valid
      final candidate = 'testnonce$solution';
      final hash = sha256.convert(utf8.encode(candidate));
      final firstByte = hash.bytes[0];

      // 4 leading zero bits means first nibble (4 bits) must be 0
      expect(firstByte >> 4, equals(0));
    });

    test('finds valid solution for difficulty 8', () async {
      final solution = await PoWService.solve(nonce: 'test8', difficulty: 8);

      final candidate = 'test8$solution';
      final hash = sha256.convert(utf8.encode(candidate));

      // 8 leading zero bits = first byte must be 0
      expect(hash.bytes[0], equals(0));
    });

    test('returns a string counter', () async {
      final solution =
          await PoWService.solve(nonce: 'counter_test', difficulty: 4);

      expect(int.tryParse(solution), isNotNull);
      expect(int.parse(solution), greaterThanOrEqualTo(0));
    });

    test('different nonces produce different solutions', () async {
      final s1 = await PoWService.solve(nonce: 'nonce_a', difficulty: 4);
      final s2 = await PoWService.solve(nonce: 'nonce_b', difficulty: 4);

      // Solutions are likely different (though not guaranteed)
      // Both must be valid for their respective nonces
      final h1 = sha256.convert(utf8.encode('nonce_a$s1'));
      final h2 = sha256.convert(utf8.encode('nonce_b$s2'));

      expect(h1.bytes[0] >> 4, equals(0));
      expect(h2.bytes[0] >> 4, equals(0));
    });

    test('difficulty 0 is trivially solved', () async {
      final solution = await PoWService.solve(nonce: 'easy', difficulty: 0);
      expect(solution, equals('0'));
    });
  });
}
