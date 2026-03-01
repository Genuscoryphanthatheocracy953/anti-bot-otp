package com.otppoc.android.services

import android.content.Context
import android.util.Base64
import com.otppoc.android.models.AttestationVerifyRequest
import com.otppoc.android.networking.ApiClient
import com.otppoc.android.networking.TokenManager
import java.security.KeyFactory
import java.security.KeyPairGenerator
import java.security.Signature
import java.security.spec.ECGenParameterSpec
import java.security.spec.PKCS8EncodedKeySpec
import java.security.spec.X509EncodedKeySpec

class AttestationService private constructor(private val context: Context) {

    private val tokenManager = TokenManager.getInstance(context)
    private val apiClient = ApiClient.getInstance(context)

    /**
     * Get or create an EC P256 key pair. The Java KeyPairGenerator produces
     * PublicKey.encoded in SPKI (X.509) format natively, and
     * Signature("SHA256withECDSA") produces DER format natively.
     */
    private fun getOrCreateKeyPair(): Pair<ByteArray, ByteArray> {
        val existingPrivate = tokenManager.attestationPrivateKey
        val existingPublic = tokenManager.attestationPublicKey
        if (existingPrivate != null && existingPublic != null) {
            return Pair(
                Base64.decode(existingPrivate, Base64.NO_WRAP),
                Base64.decode(existingPublic, Base64.NO_WRAP)
            )
        }

        val kpg = KeyPairGenerator.getInstance("EC")
        kpg.initialize(ECGenParameterSpec("secp256r1"))
        val keyPair = kpg.generateKeyPair()

        // PrivateKey.encoded = PKCS8 format
        val privateBytes = keyPair.private.encoded
        // PublicKey.encoded = X.509/SPKI format (91 bytes: 26-byte header + 65-byte point)
        val publicBytes = keyPair.public.encoded

        tokenManager.attestationPrivateKey = Base64.encodeToString(privateBytes, Base64.NO_WRAP)
        tokenManager.attestationPublicKey = Base64.encodeToString(publicBytes, Base64.NO_WRAP)

        return Pair(privateBytes, publicBytes)
    }

    fun getPublicKeyPEM(): String {
        val (_, publicBytes) = getOrCreateKeyPair()
        val base64 = Base64.encodeToString(publicBytes, Base64.DEFAULT)
        return "-----BEGIN PUBLIC KEY-----\n${base64.trim()}\n-----END PUBLIC KEY-----"
    }

    fun signChallenge(challenge: String): String {
        val (privateBytes, _) = getOrCreateKeyPair()
        val keySpec = PKCS8EncodedKeySpec(privateBytes)
        val keyFactory = KeyFactory.getInstance("EC")
        val privateKey = keyFactory.generatePrivate(keySpec)

        val signature = Signature.getInstance("SHA256withECDSA")
        signature.initSign(privateKey)
        signature.update(challenge.toByteArray(Charsets.UTF_8))
        val signedBytes = signature.sign()

        return Base64.encodeToString(signedBytes, Base64.NO_WRAP)
    }

    /**
     * Full attestation flow: get challenge -> sign -> verify -> receive JWT
     */
    suspend fun attest(): String {
        // Step 1: Get challenge
        val challengeResp = apiClient.attestChallenge()

        // Step 2: Sign challenge
        val signedResponse = signChallenge(challengeResp.challenge)

        // Step 3: Verify attestation
        val verifyBody = AttestationVerifyRequest(
            challenge_id = challengeResp.challenge_id,
            device_id = tokenManager.deviceId,
            challenge = challengeResp.challenge,
            signed_response = signedResponse,
            public_key = getPublicKeyPEM(),
            app_id = "com.otppoc.android"
        )

        val verifyResp = apiClient.attestVerify(verifyBody)

        // Store JWT
        tokenManager.attestationJwt = verifyResp.attestation_jwt
        return verifyResp.attestation_jwt
    }

    companion object {
        @Volatile
        private var instance: AttestationService? = null

        fun getInstance(context: Context): AttestationService {
            return instance ?: synchronized(this) {
                instance ?: AttestationService(context.applicationContext).also { instance = it }
            }
        }
    }
}
