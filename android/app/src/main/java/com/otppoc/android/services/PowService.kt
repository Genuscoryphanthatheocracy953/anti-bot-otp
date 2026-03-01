package com.otppoc.android.services

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.security.MessageDigest

object PowService {

    /**
     * Finds a value where SHA256(nonce + value) has `difficulty` leading zero bits.
     * Runs on Dispatchers.Default to avoid blocking the UI.
     */
    suspend fun solve(nonce: String, difficulty: Int): String = withContext(Dispatchers.Default) {
        val md = MessageDigest.getInstance("SHA-256")
        var counter = 0L
        while (true) {
            val candidate = "$nonce$counter"
            md.reset()
            val hash = md.digest(candidate.toByteArray(Charsets.UTF_8))
            if (hasLeadingZeroBits(hash, difficulty)) {
                return@withContext counter.toString()
            }
            counter++
        }
        @Suppress("UNREACHABLE_CODE")
        throw IllegalStateException("unreachable")
    }

    private fun hasLeadingZeroBits(bytes: ByteArray, count: Int): Boolean {
        var bitsChecked = 0
        for (byte in bytes) {
            if (bitsChecked >= count) return true
            for (bit in 7 downTo 0) {
                if (bitsChecked >= count) return true
                if ((byte.toInt() shr bit) and 1 != 0) {
                    return false
                }
                bitsChecked++
            }
        }
        return bitsChecked >= count
    }
}
