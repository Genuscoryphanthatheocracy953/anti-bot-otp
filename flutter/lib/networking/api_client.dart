import 'dart:collection';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;

import '../models/auth_models.dart';
import '../models/device_models.dart';
import 'hmac_signer.dart';
import 'token_manager.dart';

class ApiClient {
  static final ApiClient instance = ApiClient._();
  ApiClient._();

  String get _baseUrl =>
      Platform.isAndroid ? 'http://10.0.2.2:3000' : 'http://localhost:3000';

  // --- Public API Methods ---

  Future<ApiResponse<PreflightResponse>> preflight(
    PreflightRequest request, {
    Map<String, String>? extraHeaders,
  }) async {
    return _post(
      '/v1/auth/preflight',
      body: request.toJson(),
      extraHeaders: extraHeaders,
      fromJson: PreflightResponse.fromJson,
    );
  }

  Future<ApiResponse<OtpSendResponse>> sendOtp(
    OtpSendRequest request, {
    required String preflightToken,
  }) async {
    return _post(
      '/v1/auth/otp/send',
      body: request.toJson(),
      extraHeaders: {'X-Preflight-Token': preflightToken},
      fromJson: OtpSendResponse.fromJson,
    );
  }

  Future<ApiResponse<OtpVerifyResponse>> verifyOtp(
    OtpVerifyRequest request,
  ) async {
    return _post(
      '/v1/auth/otp/verify',
      body: request.toJson(),
      fromJson: OtpVerifyResponse.fromJson,
    );
  }

  Future<ApiResponse<SessionMeResponse>> getSession() async {
    return _get(
      '/v1/auth/session/me',
      fromJson: SessionMeResponse.fromJson,
    );
  }

  Future<ApiResponse<AttestationChallengeResponse>> requestAttestationChallenge(
    String deviceId,
  ) async {
    return _post(
      '/v1/device/attest',
      body: {'device_id': deviceId},
      fromJson: AttestationChallengeResponse.fromJson,
    );
  }

  Future<ApiResponse<AttestationVerifyResponse>> verifyAttestation(
    AttestationVerifyRequest request,
  ) async {
    return _post(
      '/v1/device/attest/verify',
      body: request.toJson(),
      fromJson: AttestationVerifyResponse.fromJson,
    );
  }

  // --- Private Request Helpers ---

  Future<ApiResponse<T>> _post<T>(
    String path, {
    required Map<String, dynamic> body,
    Map<String, String>? extraHeaders,
    required T Function(Map<String, dynamic>) fromJson,
  }) async {
    final url = Uri.parse('$_baseUrl$path');

    // Sort keys recursively for deterministic JSON (critical for HMAC body hash)
    final sortedBody = _sortMapKeys(body);
    final bodyString = jsonEncode(sortedBody);
    final bodyBytes = Uint8List.fromList(utf8.encode(bodyString));

    // HMAC sign
    final hmac = HmacSigner.sign(method: 'POST', path: path, body: bodyBytes);

    // Build headers
    final headers = await _buildHeaders(hmac, extraHeaders: extraHeaders);
    headers['Content-Type'] = 'application/json';

    final response = await http.post(url, headers: headers, body: bodyString);
    return _decodeResponse(response, fromJson);
  }

  Future<ApiResponse<T>> _get<T>(
    String path, {
    required T Function(Map<String, dynamic>) fromJson,
  }) async {
    final url = Uri.parse('$_baseUrl$path');

    // HMAC sign (no body for GET)
    final hmac = HmacSigner.sign(method: 'GET', path: path, body: null);

    final headers = await _buildHeaders(hmac);

    final response = await http.get(url, headers: headers);
    return _decodeResponse(response, fromJson);
  }

  Future<Map<String, String>> _buildHeaders(
    HmacSignResult hmac, {
    Map<String, String>? extraHeaders,
  }) async {
    final tm = TokenManager.instance;
    final deviceId = await tm.deviceId;
    final accessToken = await tm.accessToken;
    final attestationJwt = await tm.attestationJwt;

    final headers = <String, String>{
      'X-Device-Id': deviceId,
      'X-Channel': 'mobile',
      'X-Signature': hmac.signature,
      'X-Timestamp': hmac.timestamp,
      'X-Nonce': hmac.nonce,
    };

    if (accessToken != null) {
      headers['Authorization'] = 'Bearer $accessToken';
    }
    if (attestationJwt != null) {
      headers['X-Attestation-Token'] = attestationJwt;
    }
    if (extraHeaders != null) {
      headers.addAll(extraHeaders);
    }

    return headers;
  }

  ApiResponse<T> _decodeResponse<T>(
    http.Response response,
    T Function(Map<String, dynamic>) fromJson,
  ) {
    final json = jsonDecode(response.body) as Map<String, dynamic>;
    return ApiResponse.fromJson(json, fromJson);
  }

  /// Recursively sort map keys using SplayTreeMap for deterministic JSON encoding.
  /// This is CRITICAL: HMAC body hash must match server's canonical ordering.
  dynamic _sortMapKeys(dynamic value) {
    if (value is Map<String, dynamic>) {
      final sorted = SplayTreeMap<String, dynamic>();
      for (final entry in value.entries) {
        sorted[entry.key] = _sortMapKeys(entry.value);
      }
      return sorted;
    } else if (value is List) {
      return value.map(_sortMapKeys).toList();
    }
    return value;
  }
}
