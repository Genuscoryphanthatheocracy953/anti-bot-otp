import 'package:flutter_test/flutter_test.dart';
import 'package:otp_poc/utilities/phone_formatter.dart';

void main() {
  group('PhoneFormatter.normalizeToE164', () {
    test('strips spaces, dashes, and parens', () {
      expect(PhoneFormatter.normalizeToE164('+1 (555) 123-4567'),
          equals('+15551234567'));
    });

    test('prepends + if missing', () {
      expect(
          PhoneFormatter.normalizeToE164('962792084410'), equals('+962792084410'));
    });

    test('keeps existing +', () {
      expect(PhoneFormatter.normalizeToE164('+44123456789'),
          equals('+44123456789'));
    });

    test('strips all formatting characters', () {
      expect(PhoneFormatter.normalizeToE164('(+1) 555-123 4567'),
          equals('+15551234567'));
    });
  });

  group('PhoneFormatter.isValidE164', () {
    test('accepts valid E.164 numbers', () {
      expect(PhoneFormatter.isValidE164('+15551234567'), isTrue);
      expect(PhoneFormatter.isValidE164('+962792084410'), isTrue);
      expect(PhoneFormatter.isValidE164('+44123456'), isTrue);
    });

    test('rejects numbers without +', () {
      expect(PhoneFormatter.isValidE164('15551234567'), isFalse);
    });

    test('rejects numbers starting with +0', () {
      expect(PhoneFormatter.isValidE164('+0551234567'), isFalse);
    });

    test('rejects too short numbers', () {
      expect(PhoneFormatter.isValidE164('+12345'), isFalse);
    });

    test('rejects too long numbers', () {
      expect(PhoneFormatter.isValidE164('+1234567890123456'), isFalse);
    });

    test('rejects numbers with letters', () {
      expect(PhoneFormatter.isValidE164('+1555abc4567'), isFalse);
    });
  });
}
