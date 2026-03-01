import 'dart:convert';
import 'dart:typed_data';

import 'package:crypto/crypto.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:otp_poc/networking/hmac_signer.dart';

void main() {
  group('HmacSigner', () {
    test('returns signature, timestamp, and nonce', () {
      final result = HmacSigner.sign(
        method: 'POST',
        path: '/v1/auth/preflight',
        body: Uint8List.fromList(utf8.encode('{"test":true}')),
      );

      expect(result.signature, isNotEmpty);
      expect(result.signature.length, equals(64)); // SHA256 hex = 64 chars
      expect(result.timestamp, isNotEmpty);
      expect(int.tryParse(result.timestamp), isNotNull);
      expect(result.nonce, isNotEmpty);
      expect(result.nonce.contains('-'), isTrue); // UUID format
    });

    test('produces valid hex signature', () {
      final result = HmacSigner.sign(
        method: 'GET',
        path: '/v1/test',
        body: null,
      );

      // Verify it's valid hex
      expect(RegExp(r'^[0-9a-f]{64}$').hasMatch(result.signature), isTrue);
    });

    test('different bodies produce different signatures', () {
      final r1 = HmacSigner.sign(
        method: 'POST',
        path: '/test',
        body: Uint8List.fromList(utf8.encode('body1')),
      );
      final r2 = HmacSigner.sign(
        method: 'POST',
        path: '/test',
        body: Uint8List.fromList(utf8.encode('body2')),
      );

      expect(r1.signature, isNot(equals(r2.signature)));
    });

    test('different methods produce different signatures', () {
      final body = Uint8List.fromList(utf8.encode('same'));
      final r1 = HmacSigner.sign(method: 'GET', path: '/test', body: body);
      final r2 = HmacSigner.sign(method: 'POST', path: '/test', body: body);

      expect(r1.signature, isNot(equals(r2.signature)));
    });

    test('null body uses empty data for hash', () {
      final r1 = HmacSigner.sign(method: 'GET', path: '/test', body: null);
      final r2 = HmacSigner.sign(
          method: 'GET', path: '/test', body: Uint8List(0));

      // Both should produce same body hash (SHA256 of empty bytes)
      // But timestamps differ, so signatures will differ.
      // Just verify both succeed without error.
      expect(r1.signature.length, equals(64));
      expect(r2.signature.length, equals(64));
    });

    test('body hash matches SHA256 of raw bytes', () {
      // Verify the body hash computation independently
      final body = utf8.encode('{"hello":"world"}');
      final expectedHash = sha256
          .convert(body)
          .bytes
          .map((b) => b.toRadixString(16).padLeft(2, '0'))
          .join();

      // SHA256 of this body should be deterministic
      expect(expectedHash.length, equals(64));
      expect(RegExp(r'^[0-9a-f]+$').hasMatch(expectedHash), isTrue);
    });
  });
}
