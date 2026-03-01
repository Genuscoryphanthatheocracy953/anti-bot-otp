package com.otppoc.android.networking

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import java.util.UUID

class TokenManager private constructor(context: Context) {

    private val prefs: SharedPreferences

    init {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()

        prefs = EncryptedSharedPreferences.create(
            context,
            "otppoc_secure_prefs",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    var accessToken: String?
        get() = prefs.getString(KEY_ACCESS_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_ACCESS_TOKEN, value).apply()

    var refreshToken: String?
        get() = prefs.getString(KEY_REFRESH_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_REFRESH_TOKEN, value).apply()

    var attestationJwt: String?
        get() = prefs.getString(KEY_ATTESTATION_JWT, null)
        set(value) = prefs.edit().putString(KEY_ATTESTATION_JWT, value).apply()

    val deviceId: String
        get() {
            val existing = prefs.getString(KEY_DEVICE_ID, null)
            if (existing != null) return existing
            val newId = UUID.randomUUID().toString()
            prefs.edit().putString(KEY_DEVICE_ID, newId).apply()
            return newId
        }

    var attestationPrivateKey: String?
        get() = prefs.getString(KEY_ATTEST_PRIVATE, null)
        set(value) = prefs.edit().putString(KEY_ATTEST_PRIVATE, value).apply()

    var attestationPublicKey: String?
        get() = prefs.getString(KEY_ATTEST_PUBLIC, null)
        set(value) = prefs.edit().putString(KEY_ATTEST_PUBLIC, value).apply()

    fun clearAll() {
        prefs.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .remove(KEY_ATTESTATION_JWT)
            .apply()
    }

    companion object {
        private const val KEY_ACCESS_TOKEN = "otppoc.access_token"
        private const val KEY_REFRESH_TOKEN = "otppoc.refresh_token"
        private const val KEY_ATTESTATION_JWT = "otppoc.attestation_jwt"
        private const val KEY_DEVICE_ID = "otppoc.device_id"
        private const val KEY_ATTEST_PRIVATE = "otppoc.attestation.private_key"
        private const val KEY_ATTEST_PUBLIC = "otppoc.attestation.public_key"

        @Volatile
        private var instance: TokenManager? = null

        fun getInstance(context: Context): TokenManager {
            return instance ?: synchronized(this) {
                instance ?: TokenManager(context.applicationContext).also { instance = it }
            }
        }
    }
}
