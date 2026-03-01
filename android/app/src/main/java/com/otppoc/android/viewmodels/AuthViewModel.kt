package com.otppoc.android.viewmodels

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.otppoc.android.models.*
import com.otppoc.android.networking.ApiClient
import com.otppoc.android.networking.TokenManager
import com.otppoc.android.services.AttestationService
import com.otppoc.android.services.IntegrityService
import com.otppoc.android.services.PowService
import com.otppoc.android.utilities.PhoneFormatter
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class AuthState {
    data object PhoneInput : AuthState()
    data object RunningPreflight : AuthState()
    data object SolvingPoW : AuthState()
    data object SendingOtp : AuthState()
    data object OtpSent : AuthState()
    data object VerifyingOtp : AuthState()
    data object Authenticated : AuthState()
    data class Error(val message: String) : AuthState()
}

class AuthViewModel(application: Application) : AndroidViewModel(application) {

    private val _state = MutableStateFlow<AuthState>(AuthState.PhoneInput)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    private val _phone = MutableStateFlow("")
    val phone: StateFlow<String> = _phone.asStateFlow()

    private val _otpCode = MutableStateFlow("")
    val otpCode: StateFlow<String> = _otpCode.asStateFlow()

    private val _statusMessage = MutableStateFlow("")
    val statusMessage: StateFlow<String> = _statusMessage.asStateFlow()

    private val _session = MutableStateFlow<SessionMeResponse?>(null)
    val session: StateFlow<SessionMeResponse?> = _session.asStateFlow()

    private var challengeId: String? = null
    private var preflightToken: String? = null

    private val appContext = application.applicationContext
    private val apiClient = ApiClient.getInstance(application)
    private val tokenManager = TokenManager.getInstance(application)
    private val attestationService = AttestationService.getInstance(application)

    // Timing tracking for defense layer
    private val viewLoadTime = System.currentTimeMillis()
    private var firstInteractionTime: Long? = null

    fun updatePhone(value: String) {
        _phone.value = value
    }

    fun updateOtpCode(value: String) {
        _otpCode.value = value.filter { it.isDigit() }.take(6)
    }

    fun recordInteraction() {
        if (firstInteractionTime == null) {
            firstInteractionTime = System.currentTimeMillis()
        }
    }

    fun startAuth() {
        val phoneValue = _phone.value
        if (phoneValue.isEmpty()) return

        val normalized = PhoneFormatter.normalizeToE164(phoneValue)
        if (!PhoneFormatter.isValidE164(normalized)) {
            _state.value = AuthState.Error("Invalid phone number. Use E.164 format (e.g., +15551234567)")
            return
        }

        viewModelScope.launch {
            try {
                // Step 0: Attestation (mobile requirement)
                _state.value = AuthState.RunningPreflight
                _statusMessage.value = "Running device attestation..."

                if (tokenManager.attestationJwt == null) {
                    attestationService.attest()
                }

                // Step 1: Preflight — run full integrity checks and build client signals
                _statusMessage.value = "Running integrity checks..."
                val integrity = IntegrityService.check(appContext)
                val now = System.currentTimeMillis()

                val clientSignals = ClientSignals(
                    honeypot_name = "",
                    honeypot_email = "",
                    honeypot_url = "",
                    automation_signals = AutomationSignals(
                        // Backend-recognized fields (risk.service.ts mobile path)
                        jailbroken = integrity.rooted,
                        debugger_attached = integrity.debuggerAttached,
                        suspicious_dylibs = integrity.suspiciousLibs,
                        // Extended Android signals
                        emulator = integrity.emulator,
                        ui_automation = integrity.uiAutomation,
                        hooking_framework = integrity.hookingFramework,
                        screen_reader_abuse = integrity.screenReader,
                        overlay_detected = integrity.overlayDetected
                    ),
                    timing = TimingData(
                        page_load_ts = viewLoadTime,
                        first_interaction_ts = firstInteractionTime,
                        form_submit_ts = now
                    )
                )

                _statusMessage.value = "Running preflight..."
                val pf = apiClient.preflight(clientSignals)
                preflightToken = pf.token
                _statusMessage.value = "Risk score: ${pf.risk_score}"

                // Step 2: PoW if required
                var powSolution: PowSolutionRequest? = null
                if (pf.requires_pow == true && pf.pow_challenge != null) {
                    _state.value = AuthState.SolvingPoW
                    _statusMessage.value =
                        "Solving proof-of-work (difficulty: ${pf.pow_challenge.difficulty})..."
                    val solution = PowService.solve(
                        pf.pow_challenge.nonce,
                        pf.pow_challenge.difficulty
                    )
                    powSolution = PowSolutionRequest(
                        nonce = pf.pow_challenge.nonce,
                        solution = solution,
                        challenge_id = pf.pow_challenge.challenge_id
                    )
                    _statusMessage.value = "PoW solved!"
                }

                // Step 3: Send OTP
                _state.value = AuthState.SendingOtp
                _statusMessage.value = "Sending OTP..."
                val otpResp = apiClient.sendOtp(
                    phone = normalized,
                    purpose = "login",
                    preflightToken = pf.token,
                    powSolution = powSolution,
                    captchaToken = if (pf.requires_captcha == true) "pass" else null
                )

                challengeId = otpResp.challenge_id
                _state.value = AuthState.OtpSent
                _statusMessage.value = "OTP sent! Check Telegram or backend console."
            } catch (e: Exception) {
                _state.value = AuthState.Error(e.message ?: "Unknown error")
            }
        }
    }

    fun verifyOtp() {
        val cid = challengeId
        if (cid == null) {
            _state.value = AuthState.Error("No challenge ID")
            return
        }

        val normalized = PhoneFormatter.normalizeToE164(_phone.value)

        viewModelScope.launch {
            try {
                _state.value = AuthState.VerifyingOtp
                _statusMessage.value = "Verifying OTP..."

                val result = apiClient.verifyOtp(
                    phone = normalized,
                    code = _otpCode.value,
                    challengeId = cid
                )

                // Store tokens
                tokenManager.accessToken = result.access_token
                result.refresh_token?.let { tokenManager.refreshToken = it }

                // Fetch session
                _statusMessage.value = "Fetching session..."
                val sessionData = apiClient.getSession()
                _session.value = sessionData
                _state.value = AuthState.Authenticated
                _statusMessage.value = ""
            } catch (e: Exception) {
                _state.value = AuthState.OtpSent
                _statusMessage.value = e.message ?: "Verification failed"
            }
        }
    }

    fun reset() {
        _state.value = AuthState.PhoneInput
        _phone.value = ""
        _otpCode.value = ""
        _statusMessage.value = ""
        _session.value = null
        challengeId = null
        preflightToken = null
        tokenManager.clearAll()
    }
}
