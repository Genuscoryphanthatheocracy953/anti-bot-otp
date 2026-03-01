class ApiResponse<T> {
  final bool success;
  final T? data;
  final ApiErrorBody? error;

  ApiResponse({required this.success, this.data, this.error});

  factory ApiResponse.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic>)? fromJsonT,
  ) {
    return ApiResponse(
      success: json['success'] as bool,
      data: json['data'] != null && fromJsonT != null
          ? fromJsonT(json['data'] as Map<String, dynamic>)
          : null,
      error: json['error'] != null
          ? ApiErrorBody.fromJson(json['error'] as Map<String, dynamic>)
          : null,
    );
  }
}

class ApiErrorBody {
  final String code;
  final String message;
  final int? retryAfter;

  ApiErrorBody({required this.code, required this.message, this.retryAfter});

  factory ApiErrorBody.fromJson(Map<String, dynamic> json) {
    return ApiErrorBody(
      code: json['code'] as String,
      message: json['message'] as String,
      retryAfter: json['retry_after'] as int?,
    );
  }
}

// --- Request Models ---

class PreflightRequest {
  final String channel;
  final String deviceId;
  final String? fingerprint;
  final ClientSignals? clientSignals;

  PreflightRequest({
    required this.channel,
    required this.deviceId,
    this.fingerprint,
    this.clientSignals,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'channel': channel,
      'device_id': deviceId,
    };
    if (fingerprint != null) map['fingerprint'] = fingerprint;
    if (clientSignals != null) map['client_signals'] = clientSignals!.toJson();
    return map;
  }
}

class OtpSendRequest {
  final String phone;
  final String purpose;
  final PowSolutionRequest? powSolution;
  final String? captchaToken;

  OtpSendRequest({
    required this.phone,
    required this.purpose,
    this.powSolution,
    this.captchaToken,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'phone': phone,
      'purpose': purpose,
    };
    if (powSolution != null) map['pow_solution'] = powSolution!.toJson();
    if (captchaToken != null) map['captcha_token'] = captchaToken;
    return map;
  }
}

class PowSolutionRequest {
  final String nonce;
  final String solution;
  final String challengeId;

  PowSolutionRequest({
    required this.nonce,
    required this.solution,
    required this.challengeId,
  });

  Map<String, dynamic> toJson() => {
        'nonce': nonce,
        'solution': solution,
        'challenge_id': challengeId,
      };
}

class OtpVerifyRequest {
  final String phone;
  final String code;
  final String challengeId;
  final String deviceId;

  OtpVerifyRequest({
    required this.phone,
    required this.code,
    required this.challengeId,
    required this.deviceId,
  });

  Map<String, dynamic> toJson() => {
        'phone': phone,
        'code': code,
        'challenge_id': challengeId,
        'device_id': deviceId,
      };
}

// --- Response Models ---

class PreflightResponse {
  final String token;
  final String sessionId;
  final double riskScore;
  final int expiresAt;
  final PowChallengeData? powChallenge;
  final bool requiresPow;
  final bool requiresCaptcha;

  PreflightResponse({
    required this.token,
    required this.sessionId,
    required this.riskScore,
    required this.expiresAt,
    this.powChallenge,
    required this.requiresPow,
    required this.requiresCaptcha,
  });

  factory PreflightResponse.fromJson(Map<String, dynamic> json) {
    return PreflightResponse(
      token: json['token'] as String,
      sessionId: json['session_id'] as String,
      riskScore: (json['risk_score'] as num).toDouble(),
      expiresAt: (json['expires_at'] as num).toInt(),
      powChallenge: json['pow_challenge'] != null
          ? PowChallengeData.fromJson(
              json['pow_challenge'] as Map<String, dynamic>)
          : null,
      requiresPow: json['requires_pow'] as bool? ?? false,
      requiresCaptcha: json['requires_captcha'] as bool? ?? false,
    );
  }
}

class PowChallengeData {
  final String nonce;
  final int difficulty;
  final String challengeId;

  PowChallengeData({
    required this.nonce,
    required this.difficulty,
    required this.challengeId,
  });

  factory PowChallengeData.fromJson(Map<String, dynamic> json) {
    return PowChallengeData(
      nonce: json['nonce'] as String,
      difficulty: (json['difficulty'] as num).toInt(),
      challengeId: json['challenge_id'] as String,
    );
  }
}

class OtpSendResponse {
  final String challengeId;
  final int expiresAt;
  final String purpose;

  OtpSendResponse({
    required this.challengeId,
    required this.expiresAt,
    required this.purpose,
  });

  factory OtpSendResponse.fromJson(Map<String, dynamic> json) {
    return OtpSendResponse(
      challengeId: json['challenge_id'] as String,
      expiresAt: (json['expires_at'] as num).toInt(),
      purpose: json['purpose'] as String,
    );
  }
}

class OtpVerifyResponse {
  final String accessToken;
  final String? refreshToken;
  final String tokenType;
  final int expiresIn;

  OtpVerifyResponse({
    required this.accessToken,
    this.refreshToken,
    required this.tokenType,
    required this.expiresIn,
  });

  factory OtpVerifyResponse.fromJson(Map<String, dynamic> json) {
    return OtpVerifyResponse(
      accessToken: json['access_token'] as String,
      refreshToken: json['refresh_token'] as String?,
      tokenType: json['token_type'] as String,
      expiresIn: (json['expires_in'] as num).toInt(),
    );
  }
}

class SessionMeResponse {
  final String phone;
  final String deviceId;
  final String channel;
  final int issuedAt;
  final int expiresAt;

  SessionMeResponse({
    required this.phone,
    required this.deviceId,
    required this.channel,
    required this.issuedAt,
    required this.expiresAt,
  });

  factory SessionMeResponse.fromJson(Map<String, dynamic> json) {
    return SessionMeResponse(
      phone: json['phone'] as String,
      deviceId: json['device_id'] as String,
      channel: json['channel'] as String,
      issuedAt: (json['issued_at'] as num).toInt(),
      expiresAt: (json['expires_at'] as num).toInt(),
    );
  }
}

// --- Client Signals ---

class ClientSignals {
  final AutomationSignals automationSignals;
  final TimingData timing;

  ClientSignals({required this.automationSignals, required this.timing});

  Map<String, dynamic> toJson() => {
        'automation_signals': automationSignals.toJson(),
        'timing': timing.toJson(),
      };
}

class AutomationSignals {
  final bool jailbroken;
  final bool debuggerAttached;
  final bool suspiciousDylibs;

  AutomationSignals({
    required this.jailbroken,
    required this.debuggerAttached,
    required this.suspiciousDylibs,
  });

  Map<String, dynamic> toJson() => {
        'jailbroken': jailbroken,
        'debugger_attached': debuggerAttached,
        'suspicious_dylibs': suspiciousDylibs,
      };
}

class TimingData {
  final int pageLoadTs;
  final int? firstInteractionTs;
  final int formSubmitTs;

  TimingData({
    required this.pageLoadTs,
    this.firstInteractionTs,
    required this.formSubmitTs,
  });

  Map<String, dynamic> toJson() {
    final map = <String, dynamic>{
      'page_load_ts': pageLoadTs,
      'form_submit_ts': formSubmitTs,
    };
    if (firstInteractionTs != null) {
      map['first_interaction_ts'] = firstInteractionTs;
    }
    return map;
  }
}
