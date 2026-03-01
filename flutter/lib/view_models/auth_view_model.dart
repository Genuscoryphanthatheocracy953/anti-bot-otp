import 'package:flutter/foundation.dart';

import '../models/auth_models.dart';
import '../models/device_models.dart';
import '../networking/api_client.dart';
import '../networking/token_manager.dart';
import '../services/attestation_service.dart';
import '../services/integrity_service.dart';
import '../services/pow_service.dart';
import '../utilities/phone_formatter.dart';

enum AuthState {
  phoneInput,
  runningPreflight,
  solvingPoW,
  sendingOtp,
  otpSent,
  verifyingOtp,
  authenticated,
  error,
}

class AuthViewModel extends ChangeNotifier {
  AuthState _state = AuthState.phoneInput;
  String _phone = '';
  String _otpCode = '';
  String _statusMessage = '';
  String _errorMessage = '';
  SessionMeResponse? _session;

  // Timing analysis
  final DateTime _viewLoadTime = DateTime.now();
  DateTime? _firstInteractionTime;

  // Internal state
  String _preflightToken = '';
  String _challengeId = '';
  String _normalizedPhone = '';

  // Getters
  AuthState get state => _state;
  String get phone => _phone;
  String get otpCode => _otpCode;
  String get statusMessage => _statusMessage;
  String get errorMessage => _errorMessage;
  SessionMeResponse? get session => _session;

  set phone(String value) {
    _phone = value;
    notifyListeners();
  }

  set otpCode(String value) {
    // Filter to digits only, max 6
    final digits = value.replaceAll(RegExp(r'[^0-9]'), '');
    _otpCode = digits.length > 6 ? digits.substring(0, 6) : digits;
    notifyListeners();
  }

  void recordInteraction() {
    _firstInteractionTime ??= DateTime.now();
  }

  int get currentStep {
    switch (_state) {
      case AuthState.phoneInput:
      case AuthState.error:
        return 0;
      case AuthState.runningPreflight:
      case AuthState.solvingPoW:
      case AuthState.sendingOtp:
      case AuthState.otpSent:
      case AuthState.verifyingOtp:
        return 1;
      case AuthState.authenticated:
        return 2;
    }
  }

  // --- Auth Flow ---

  Future<void> startAuth() async {
    try {
      // 1. Normalize and validate phone
      _normalizedPhone = PhoneFormatter.normalizeToE164(_phone);
      if (!PhoneFormatter.isValidE164(_normalizedPhone)) {
        _setError('Invalid phone number. Use E.164 format (e.g. +1234567890)');
        return;
      }

      _setState(AuthState.runningPreflight, 'Running security checks...');

      final api = ApiClient.instance;
      final tm = TokenManager.instance;
      final deviceId = await tm.deviceId;

      // 2. Attestation (if not cached)
      final existingJwt = await tm.attestationJwt;
      if (existingJwt == null) {
        _setStatus('Device attestation...');
        await _performAttestation(api, deviceId);
      }

      // 3. Integrity checks
      _setStatus('Integrity check...');
      final integrity = await IntegrityService.check();

      // 4. Build client signals
      final now = DateTime.now();
      final signals = ClientSignals(
        automationSignals: AutomationSignals(
          jailbroken: integrity.jailbrokenOrRooted,
          debuggerAttached: integrity.debuggerAttached,
          suspiciousDylibs: integrity.suspiciousLibraries,
        ),
        timing: TimingData(
          pageLoadTs: _viewLoadTime.millisecondsSinceEpoch,
          firstInteractionTs: _firstInteractionTime?.millisecondsSinceEpoch,
          formSubmitTs: now.millisecondsSinceEpoch,
        ),
      );

      // 5. Preflight
      _setStatus('Preflight check...');
      final preflightReq = PreflightRequest(
        channel: 'mobile',
        deviceId: deviceId,
        clientSignals: signals,
      );
      final preflightRes = await api.preflight(preflightReq);
      if (!preflightRes.success || preflightRes.data == null) {
        _setError(preflightRes.error?.message ?? 'Preflight failed');
        return;
      }
      _preflightToken = preflightRes.data!.token;

      // 6. PoW if required
      PowSolutionRequest? powSolution;
      if (preflightRes.data!.requiresPow &&
          preflightRes.data!.powChallenge != null) {
        _setState(AuthState.solvingPoW, 'Solving proof-of-work...');
        final pow = preflightRes.data!.powChallenge!;
        final solution = await PoWService.solve(
          nonce: pow.nonce,
          difficulty: pow.difficulty,
        );
        powSolution = PowSolutionRequest(
          nonce: pow.nonce,
          solution: solution,
          challengeId: pow.challengeId,
        );
      }

      // 7. Send OTP
      _setState(AuthState.sendingOtp, 'Sending OTP...');
      final sendReq = OtpSendRequest(
        phone: _normalizedPhone,
        purpose: 'login',
        powSolution: powSolution,
      );
      final sendRes = await api.sendOtp(
        sendReq,
        preflightToken: _preflightToken,
      );
      if (!sendRes.success || sendRes.data == null) {
        _setError(sendRes.error?.message ?? 'Failed to send OTP');
        return;
      }
      _challengeId = sendRes.data!.challengeId;

      _setState(AuthState.otpSent, 'OTP sent!');
    } catch (e) {
      _setError('Error: $e');
    }
  }

  Future<void> verifyOtp() async {
    try {
      _setState(AuthState.verifyingOtp, 'Verifying OTP...');

      final api = ApiClient.instance;
      final tm = TokenManager.instance;
      final deviceId = await tm.deviceId;

      // 1. Verify OTP
      final verifyReq = OtpVerifyRequest(
        phone: _normalizedPhone,
        code: _otpCode,
        challengeId: _challengeId,
        deviceId: deviceId,
      );
      final verifyRes = await api.verifyOtp(verifyReq);
      if (!verifyRes.success || verifyRes.data == null) {
        _setError(verifyRes.error?.message ?? 'OTP verification failed');
        return;
      }

      // 2. Store tokens
      await tm.setAccessToken(verifyRes.data!.accessToken);
      if (verifyRes.data!.refreshToken != null) {
        await tm.setRefreshToken(verifyRes.data!.refreshToken!);
      }

      // 3. Fetch session
      _setStatus('Fetching session...');
      final sessionRes = await api.getSession();
      if (!sessionRes.success || sessionRes.data == null) {
        _setError(sessionRes.error?.message ?? 'Failed to fetch session');
        return;
      }
      _session = sessionRes.data;

      _setState(AuthState.authenticated, 'Authenticated!');
    } catch (e) {
      _setError('Error: $e');
    }
  }

  Future<void> reset() async {
    await TokenManager.instance.clearAll();
    _state = AuthState.phoneInput;
    _phone = '';
    _otpCode = '';
    _statusMessage = '';
    _errorMessage = '';
    _session = null;
    _preflightToken = '';
    _challengeId = '';
    _normalizedPhone = '';
    _firstInteractionTime = null;
    notifyListeners();
  }

  // --- Private helpers ---

  Future<void> _performAttestation(ApiClient api, String deviceId) async {
    // Request challenge
    final challengeRes = await api.requestAttestationChallenge(deviceId);
    if (!challengeRes.success || challengeRes.data == null) {
      // Non-fatal: attestation may fail on simulators
      return;
    }
    final challenge = challengeRes.data!;

    // Sign challenge
    final keyPair = await AttestationService.getOrCreateKeyPair();
    final signedResponse =
        AttestationService.signChallenge(challenge.challenge, keyPair.privateKey);

    // Verify
    final verifyReq = AttestationVerifyRequest(
      challengeId: challenge.challengeId,
      deviceId: deviceId,
      challenge: challenge.challenge,
      signedResponse: signedResponse,
      publicKey: keyPair.publicKeyPem,
      appId: AttestationService.appId,
    );
    final verifyRes = await api.verifyAttestation(verifyReq);
    if (verifyRes.success && verifyRes.data != null) {
      await TokenManager.instance
          .setAttestationJwt(verifyRes.data!.attestationJwt);
    }
  }

  void _setState(AuthState newState, String message) {
    _state = newState;
    _statusMessage = message;
    _errorMessage = '';
    notifyListeners();
  }

  void _setStatus(String message) {
    _statusMessage = message;
    notifyListeners();
  }

  void _setError(String message) {
    _state = AuthState.error;
    _errorMessage = message;
    _statusMessage = '';
    notifyListeners();
  }
}
