import 'package:flutter_test/flutter_test.dart';
import 'package:otp_poc/models/device_models.dart';

void main() {
  group('AttestationChallengeResponse.fromJson', () {
    test('parses challenge and challenge_id', () {
      final json = {
        'challenge': 'abcdef1234567890',
        'challenge_id': 'ch-attest-1',
      };

      final response = AttestationChallengeResponse.fromJson(json);

      expect(response.challenge, equals('abcdef1234567890'));
      expect(response.challengeId, equals('ch-attest-1'));
    });
  });

  group('AttestationVerifyRequest serialization', () {
    test('toJson includes all fields', () {
      final req = AttestationVerifyRequest(
        challengeId: 'ch-1',
        deviceId: 'dev-1',
        challenge: 'abc123',
        signedResponse: 'base64sig==',
        publicKey: '-----BEGIN PUBLIC KEY-----\nMFk...\n-----END PUBLIC KEY-----',
        appId: 'com.otppoc.OTPPoc',
      );

      final json = req.toJson();

      expect(json['challenge_id'], equals('ch-1'));
      expect(json['device_id'], equals('dev-1'));
      expect(json['challenge'], equals('abc123'));
      expect(json['signed_response'], equals('base64sig=='));
      expect(json['public_key'], contains('BEGIN PUBLIC KEY'));
      expect(json['app_id'], equals('com.otppoc.OTPPoc'));
    });
  });

  group('AttestationVerifyResponse.fromJson', () {
    test('parses all fields including optional note', () {
      final json = {
        'attestation_jwt': 'eyJ.jwt.token',
        'expires_in': 86400,
        'note': 'PoC attestation',
      };

      final response = AttestationVerifyResponse.fromJson(json);

      expect(response.attestationJwt, equals('eyJ.jwt.token'));
      expect(response.expiresIn, equals(86400));
      expect(response.note, equals('PoC attestation'));
    });

    test('handles null note', () {
      final json = {
        'attestation_jwt': 'eyJ.jwt.token',
        'expires_in': 86400,
      };

      final response = AttestationVerifyResponse.fromJson(json);
      expect(response.note, isNull);
    });
  });
}
