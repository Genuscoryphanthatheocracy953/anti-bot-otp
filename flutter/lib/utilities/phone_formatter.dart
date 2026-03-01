class PhoneFormatter {
  static String normalizeToE164(String phone) {
    var cleaned = phone.replaceAll(RegExp(r'[\s\-\(\)]'), '');
    if (!cleaned.startsWith('+')) {
      cleaned = '+$cleaned';
    }
    return cleaned;
  }

  static bool isValidE164(String phone) {
    return RegExp(r'^\+[1-9]\d{6,14}$').hasMatch(phone);
  }
}
