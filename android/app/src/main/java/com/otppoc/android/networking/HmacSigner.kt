package com.otppoc.android.networking

import java.security.MessageDigest
import java.util.UUID
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

object HmacSigner {
    // PoC: Key embedded in app. In production, derive from attestation or fetch securely.
    private const val CLIENT_KEY =
        "d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4"

    data class SignatureResult(
        val signature: String,
        val timestamp: String,
        val nonce: String
    )

    fun sign(method: String, path: String, body: ByteArray?): SignatureResult {
        val timestamp = (System.currentTimeMillis() / 1000).toString()
        val nonce = UUID.randomUUID().toString()

        val bodyHash = sha256Hex(body ?: ByteArray(0))
        val payload = "$method\n$path\n$timestamp\n$bodyHash"

        // Key used as raw UTF-8 bytes (NOT hex-decoded)
        val keyBytes = CLIENT_KEY.toByteArray(Charsets.UTF_8)
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(keyBytes, "HmacSHA256"))
        val signatureBytes = mac.doFinal(payload.toByteArray(Charsets.UTF_8))
        val signatureHex = signatureBytes.joinToString("") { "%02x".format(it) }

        return SignatureResult(signatureHex, timestamp, nonce)
    }

    private fun sha256Hex(data: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(data)
        return digest.joinToString("") { "%02x".format(it) }
    }
}
