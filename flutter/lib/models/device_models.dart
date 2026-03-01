class AttestationChallengeResponse {
  final String challenge;
  final String challengeId;

  AttestationChallengeResponse({
    required this.challenge,
    required this.challengeId,
  });

  factory AttestationChallengeResponse.fromJson(Map<String, dynamic> json) {
    return AttestationChallengeResponse(
      challenge: json['challenge'] as String,
      challengeId: json['challenge_id'] as String,
    );
  }
}

class AttestationVerifyRequest {
  final String challengeId;
  final String deviceId;
  final String challenge;
  final String signedResponse;
  final String publicKey;
  final String appId;

  AttestationVerifyRequest({
    required this.challengeId,
    required this.deviceId,
    required this.challenge,
    required this.signedResponse,
    required this.publicKey,
    required this.appId,
  });

  Map<String, dynamic> toJson() => {
        'challenge_id': challengeId,
        'device_id': deviceId,
        'challenge': challenge,
        'signed_response': signedResponse,
        'public_key': publicKey,
        'app_id': appId,
      };
}

class AttestationVerifyResponse {
  final String attestationJwt;
  final int expiresIn;
  final String? note;

  AttestationVerifyResponse({
    required this.attestationJwt,
    required this.expiresIn,
    this.note,
  });

  factory AttestationVerifyResponse.fromJson(Map<String, dynamic> json) {
    return AttestationVerifyResponse(
      attestationJwt: json['attestation_jwt'] as String,
      expiresIn: json['expires_in'] as int,
      note: json['note'] as String?,
    );
  }
}
