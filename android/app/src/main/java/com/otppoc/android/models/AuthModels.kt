package com.otppoc.android.models

data class ApiResponse<T>(
    val success: Boolean,
    val data: T?,
    val error: ApiErrorBody?
)

data class ApiErrorBody(
    val code: String,
    val message: String,
    val retry_after: Int?
)

data class PreflightResponse(
    val token: String,
    val session_id: String,
    val risk_score: Int,
    val expires_at: Long,
    val pow_challenge: PowChallengeData?,
    val requires_pow: Boolean?,
    val requires_captcha: Boolean?
)

data class PowChallengeData(
    val nonce: String,
    val difficulty: Int,
    val challenge_id: String
)

data class OtpSendResponse(
    val challenge_id: String,
    val expires_at: Long,
    val purpose: String
)

data class OtpVerifyResponse(
    val access_token: String,
    val refresh_token: String?,
    val token_type: String,
    val expires_in: Int
)

data class SessionMeResponse(
    val phone: String,
    val device_id: String,
    val channel: String,
    val issued_at: Long,
    val expires_at: Long
)

data class ClientSignals(
    val honeypot_name: String = "",
    val honeypot_email: String = "",
    val honeypot_url: String = "",
    val automation_signals: AutomationSignals?,
    val timing: TimingData?
)

data class AutomationSignals(
    // Backend-recognized fields (mobile path in risk.service.ts)
    val jailbroken: Boolean,          // maps to rooted on Android
    val debugger_attached: Boolean,
    val suspicious_dylibs: Boolean,   // maps to suspicious_libs on Android
    // Extended Android-specific signals (informational for risk scoring)
    val emulator: Boolean,
    val ui_automation: Boolean,
    val hooking_framework: Boolean,
    val screen_reader_abuse: Boolean,
    val overlay_detected: Boolean
)

data class TimingData(
    val page_load_ts: Long,
    val first_interaction_ts: Long?,
    val form_submit_ts: Long
)

data class PreflightRequest(
    val channel: String,
    val device_id: String,
    val fingerprint: Map<String, String>?,
    val client_signals: ClientSignals?
)

data class OtpSendRequest(
    val phone: String,
    val purpose: String,
    val pow_solution: PowSolutionRequest?,
    val captcha_token: String?
)

data class PowSolutionRequest(
    val nonce: String,
    val solution: String,
    val challenge_id: String
)

data class OtpVerifyRequest(
    val phone: String,
    val code: String,
    val challenge_id: String,
    val device_id: String
)
