package com.otppoc.android.models

data class AttestationChallengeResponse(
    val challenge: String,
    val challenge_id: String
)

data class AttestationVerifyRequest(
    val challenge_id: String,
    val device_id: String,
    val challenge: String,
    val signed_response: String,
    val public_key: String,
    val app_id: String
)

data class AttestationVerifyResponse(
    val attestation_jwt: String,
    val expires_in: Int,
    val note: String?
)
