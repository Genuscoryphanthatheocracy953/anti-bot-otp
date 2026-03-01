package com.otppoc.android.utilities

object PhoneFormatter {

    fun normalizeToE164(phone: String): String {
        var cleaned = phone.replace(Regex("[\\s\\-()]"), "")
        if (!cleaned.startsWith("+")) {
            cleaned = "+$cleaned"
        }
        return cleaned
    }

    fun isValidE164(phone: String): Boolean {
        return Regex("^\\+[1-9]\\d{6,14}$").matches(phone)
    }
}
