package com.otppoc.android.networking

import android.content.Context
import com.google.gson.Gson
import com.google.gson.GsonBuilder
import com.google.gson.reflect.TypeToken
import com.otppoc.android.models.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.TreeMap
import java.util.concurrent.TimeUnit

class ApiClient private constructor(context: Context) {

    // Android emulator uses 10.0.2.2 to reach host machine
    private val baseUrl = "http://10.0.2.2:3000"
    private val tokenManager = TokenManager.getInstance(context)
    private val gson: Gson = GsonBuilder().serializeNulls().create()
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    /**
     * Recursively sorts all map keys to ensure deterministic JSON for HMAC body hash.
     */
    @Suppress("UNCHECKED_CAST")
    private fun sortKeys(obj: Any?): Any? {
        return when (obj) {
            is Map<*, *> -> {
                val sorted = TreeMap<String, Any?>()
                for ((key, value) in obj) {
                    sorted[key as String] = sortKeys(value)
                }
                sorted
            }
            is List<*> -> obj.map { sortKeys(it) }
            else -> obj
        }
    }

    private fun toSortedJson(body: Any): String {
        // Serialize to a generic map first, then sort recursively, then serialize back
        val jsonString = gson.toJson(body)
        val mapType = object : TypeToken<Map<String, Any?>>() {}.type
        val unsorted: Map<String, Any?> = gson.fromJson(jsonString, mapType)
        val sorted = sortKeys(unsorted)
        return gson.toJson(sorted)
    }

    suspend fun <T> request(
        method: String,
        path: String,
        body: Any? = null,
        extraHeaders: Map<String, String> = emptyMap(),
        responseType: TypeToken<ApiResponse<T>>
    ): T = withContext(Dispatchers.IO) {
        val url = "$baseUrl$path"

        // Build body
        var bodyBytes: ByteArray? = null
        val requestBuilder = Request.Builder().url(url)

        if (body != null) {
            val jsonBody = toSortedJson(body)
            bodyBytes = jsonBody.toByteArray(Charsets.UTF_8)
            requestBuilder.method(method, bodyBytes.toRequestBody(jsonMediaType))
        } else {
            when (method) {
                "POST" -> requestBuilder.method(method, "".toRequestBody(jsonMediaType))
                else -> requestBuilder.method(method, null)
            }
        }

        // Standard headers
        requestBuilder.addHeader("Content-Type", "application/json")
        requestBuilder.addHeader("X-Device-Id", tokenManager.deviceId)
        requestBuilder.addHeader("X-Channel", "mobile")

        // HMAC signing
        val sig = HmacSigner.sign(method, path, bodyBytes)
        requestBuilder.addHeader("X-Signature", sig.signature)
        requestBuilder.addHeader("X-Timestamp", sig.timestamp)
        requestBuilder.addHeader("X-Nonce", sig.nonce)

        // Auth token
        tokenManager.accessToken?.let {
            requestBuilder.addHeader("Authorization", "Bearer $it")
        }

        // Attestation token
        tokenManager.attestationJwt?.let {
            requestBuilder.addHeader("X-Attestation-Token", it)
        }

        // Extra headers
        for ((key, value) in extraHeaders) {
            requestBuilder.addHeader(key, value)
        }

        val request = requestBuilder.build()
        val response = client.newCall(request).execute()
        val responseBody = response.body?.string() ?: throw ApiException("NO_DATA", "Empty response body")

        val apiResponse: ApiResponse<T> = gson.fromJson(responseBody, responseType.type)

        if (!apiResponse.success || apiResponse.error != null) {
            val err = apiResponse.error
            throw ApiException(
                code = err?.code ?: "UNKNOWN",
                message = err?.message ?: "Unknown error",
                retryAfter = err?.retry_after
            )
        }

        apiResponse.data ?: throw ApiException("NO_DATA", "No data in response")
    }

    // Convenience methods

    suspend fun preflight(clientSignals: ClientSignals? = null): PreflightResponse {
        val body = PreflightRequest(
            channel = "mobile",
            device_id = tokenManager.deviceId,
            fingerprint = null,
            client_signals = clientSignals
        )
        return request(
            method = "POST",
            path = "/v1/auth/preflight",
            body = body,
            responseType = object : TypeToken<ApiResponse<PreflightResponse>>() {}
        )
    }

    suspend fun sendOtp(
        phone: String,
        purpose: String,
        preflightToken: String,
        powSolution: PowSolutionRequest? = null,
        captchaToken: String? = null
    ): OtpSendResponse {
        val body = OtpSendRequest(
            phone = phone,
            purpose = purpose,
            pow_solution = powSolution,
            captcha_token = captchaToken
        )
        return request(
            method = "POST",
            path = "/v1/auth/otp/send",
            body = body,
            extraHeaders = mapOf("X-Preflight-Token" to preflightToken),
            responseType = object : TypeToken<ApiResponse<OtpSendResponse>>() {}
        )
    }

    suspend fun verifyOtp(phone: String, code: String, challengeId: String): OtpVerifyResponse {
        val body = OtpVerifyRequest(
            phone = phone,
            code = code,
            challenge_id = challengeId,
            device_id = tokenManager.deviceId
        )
        return request(
            method = "POST",
            path = "/v1/auth/otp/verify",
            body = body,
            responseType = object : TypeToken<ApiResponse<OtpVerifyResponse>>() {}
        )
    }

    suspend fun getSession(): SessionMeResponse {
        return request(
            method = "GET",
            path = "/v1/auth/session/me",
            responseType = object : TypeToken<ApiResponse<SessionMeResponse>>() {}
        )
    }

    suspend fun attestChallenge(): AttestationChallengeResponse {
        val body = mapOf("device_id" to tokenManager.deviceId)
        return request(
            method = "POST",
            path = "/v1/device/attest",
            body = body,
            responseType = object : TypeToken<ApiResponse<AttestationChallengeResponse>>() {}
        )
    }

    suspend fun attestVerify(body: AttestationVerifyRequest): AttestationVerifyResponse {
        return request(
            method = "POST",
            path = "/v1/device/attest/verify",
            body = body,
            responseType = object : TypeToken<ApiResponse<AttestationVerifyResponse>>() {}
        )
    }

    companion object {
        @Volatile
        private var instance: ApiClient? = null

        fun getInstance(context: Context): ApiClient {
            return instance ?: synchronized(this) {
                instance ?: ApiClient(context.applicationContext).also { instance = it }
            }
        }
    }
}

class ApiException(
    val code: String,
    override val message: String,
    val retryAfter: Int? = null
) : Exception("$code: $message")
