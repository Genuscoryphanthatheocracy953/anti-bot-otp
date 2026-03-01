import 'package:flutter_test/flutter_test.dart';
import 'package:otp_poc/models/auth_models.dart';

void main() {
  group('PreflightResponse.fromJson', () {
    test('parses full response with PoW challenge', () {
      final json = {
        'token': 'jwt.token.here',
        'session_id': 'abc-123',
        'risk_score': 45,
        'expires_at': 1709553720,
        'pow_challenge': {
          'nonce': 'deadbeef12345678',
          'difficulty': 4,
          'challenge_id': 'pow-456',
        },
        'requires_pow': true,
        'requires_captcha': false,
      };

      final response = PreflightResponse.fromJson(json);

      expect(response.token, equals('jwt.token.here'));
      expect(response.sessionId, equals('abc-123'));
      expect(response.riskScore, equals(45.0));
      expect(response.expiresAt, equals(1709553720));
      expect(response.requiresPow, isTrue);
      expect(response.requiresCaptcha, isFalse);
      expect(response.powChallenge, isNotNull);
      expect(response.powChallenge!.nonce, equals('deadbeef12345678'));
      expect(response.powChallenge!.difficulty, equals(4));
      expect(response.powChallenge!.challengeId, equals('pow-456'));
    });

    test('handles missing optional fields gracefully', () {
      final json = {
        'token': 'jwt.token.here',
        'session_id': 'abc-123',
        'risk_score': 5,
        'expires_at': 1709553720,
      };

      final response = PreflightResponse.fromJson(json);

      expect(response.requiresPow, isFalse);
      expect(response.requiresCaptcha, isFalse);
      expect(response.powChallenge, isNull);
    });

    test('handles risk_score as double from server', () {
      final json = {
        'token': 'tok',
        'session_id': 'sid',
        'risk_score': 12.5,
        'expires_at': 1709553720,
      };

      final response = PreflightResponse.fromJson(json);
      expect(response.riskScore, equals(12.5));
    });
  });

  group('OtpSendResponse.fromJson', () {
    test('parses correctly with int expires_at', () {
      final json = {
        'challenge_id': 'ch-789',
        'expires_at': 1709553900,
        'purpose': 'login',
      };

      final response = OtpSendResponse.fromJson(json);

      expect(response.challengeId, equals('ch-789'));
      expect(response.expiresAt, equals(1709553900));
      expect(response.purpose, equals('login'));
    });
  });

  group('OtpVerifyResponse.fromJson', () {
    test('parses with refresh token', () {
      final json = {
        'access_token': 'access.jwt',
        'refresh_token': 'refresh.jwt',
        'token_type': 'Bearer',
        'expires_in': 900,
      };

      final response = OtpVerifyResponse.fromJson(json);

      expect(response.accessToken, equals('access.jwt'));
      expect(response.refreshToken, equals('refresh.jwt'));
      expect(response.tokenType, equals('Bearer'));
      expect(response.expiresIn, equals(900));
    });

    test('handles null refresh token', () {
      final json = {
        'access_token': 'access.jwt',
        'refresh_token': null,
        'token_type': 'Bearer',
        'expires_in': 900,
      };

      final response = OtpVerifyResponse.fromJson(json);
      expect(response.refreshToken, isNull);
    });
  });

  group('SessionMeResponse.fromJson', () {
    test('parses unix timestamp fields as int', () {
      final json = {
        'phone': '+15551234567',
        'device_id': 'dev-abc-123',
        'channel': 'mobile',
        'issued_at': 1709553600,
        'expires_at': 1709554500,
      };

      final response = SessionMeResponse.fromJson(json);

      expect(response.phone, equals('+15551234567'));
      expect(response.deviceId, equals('dev-abc-123'));
      expect(response.channel, equals('mobile'));
      expect(response.issuedAt, equals(1709553600));
      expect(response.expiresAt, equals(1709554500));
    });
  });

  group('ApiResponse.fromJson', () {
    test('parses success response with data', () {
      final json = {
        'success': true,
        'data': {
          'challenge_id': 'ch-1',
          'expires_at': 100,
          'purpose': 'login',
        },
      };

      final response = ApiResponse.fromJson(json, OtpSendResponse.fromJson);

      expect(response.success, isTrue);
      expect(response.data, isNotNull);
      expect(response.data!.challengeId, equals('ch-1'));
      expect(response.error, isNull);
    });

    test('parses error response', () {
      final json = {
        'success': false,
        'data': null,
        'error': {
          'code': 'RATE_LIMITED',
          'message': 'Too many requests',
          'retry_after': 60,
        },
      };

      final response = ApiResponse<OtpSendResponse>.fromJson(json, OtpSendResponse.fromJson);

      expect(response.success, isFalse);
      expect(response.data, isNull);
      expect(response.error, isNotNull);
      expect(response.error!.code, equals('RATE_LIMITED'));
      expect(response.error!.retryAfter, equals(60));
    });
  });

  group('Request model serialization', () {
    test('PreflightRequest.toJson includes client_signals', () {
      final req = PreflightRequest(
        channel: 'mobile',
        deviceId: 'dev-1',
        clientSignals: ClientSignals(
          automationSignals: AutomationSignals(
            jailbroken: false,
            debuggerAttached: false,
            suspiciousDylibs: false,
          ),
          timing: TimingData(
            pageLoadTs: 1000,
            firstInteractionTs: 2000,
            formSubmitTs: 3000,
          ),
        ),
      );

      final json = req.toJson();

      expect(json['channel'], equals('mobile'));
      expect(json['device_id'], equals('dev-1'));
      expect(json['client_signals'], isNotNull);
      expect(json['client_signals']['timing']['page_load_ts'], equals(1000));
      expect(json['client_signals']['timing']['first_interaction_ts'], equals(2000));
    });

    test('PreflightRequest.toJson omits null fields', () {
      final req = PreflightRequest(channel: 'web', deviceId: 'dev-2');
      final json = req.toJson();

      expect(json.containsKey('fingerprint'), isFalse);
      expect(json.containsKey('client_signals'), isFalse);
    });

    test('OtpSendRequest.toJson includes pow_solution when present', () {
      final req = OtpSendRequest(
        phone: '+15551234567',
        purpose: 'login',
        powSolution: PowSolutionRequest(
          nonce: 'abc',
          solution: '12345',
          challengeId: 'ch-1',
        ),
      );

      final json = req.toJson();

      expect(json['pow_solution'], isNotNull);
      expect(json['pow_solution']['solution'], equals('12345'));
    });

    test('OtpVerifyRequest.toJson has all fields', () {
      final req = OtpVerifyRequest(
        phone: '+1555',
        code: '123456',
        challengeId: 'ch-1',
        deviceId: 'dev-1',
      );

      final json = req.toJson();

      expect(json['phone'], equals('+1555'));
      expect(json['code'], equals('123456'));
      expect(json['challenge_id'], equals('ch-1'));
      expect(json['device_id'], equals('dev-1'));
    });

    test('TimingData.toJson omits null first_interaction_ts', () {
      final timing = TimingData(pageLoadTs: 1000, formSubmitTs: 3000);
      final json = timing.toJson();

      expect(json.containsKey('first_interaction_ts'), isFalse);
      expect(json['page_load_ts'], equals(1000));
      expect(json['form_submit_ts'], equals(3000));
    });
  });
}
