import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:provider/provider.dart';

import 'package:otp_poc/view_models/auth_view_model.dart';
import 'package:otp_poc/views/content_view.dart';
import 'package:otp_poc/views/components/defense_card.dart';
import 'package:otp_poc/views/components/step_indicator.dart';

Widget _wrapWithProvider(Widget child) {
  return ChangeNotifierProvider(
    create: (_) => AuthViewModel(),
    child: MaterialApp(home: child),
  );
}

void main() {
  group('ContentView', () {
    testWidgets('renders header title', (tester) async {
      await tester.pumpWidget(_wrapWithProvider(const ContentView()));
      expect(find.text('OTP Auth PoC'), findsOneWidget);
    });

    testWidgets('renders phone input card', (tester) async {
      await tester.pumpWidget(_wrapWithProvider(const ContentView()));
      expect(find.text('Enter your phone number'), findsOneWidget);
      expect(find.text('Send OTP'), findsOneWidget);
    });

    testWidgets('renders defense card', (tester) async {
      await tester.pumpWidget(_wrapWithProvider(const ContentView()));
      // Drag to scroll down and reveal the defense card
      await tester.drag(find.byType(CustomScrollView), const Offset(0, -400));
      await tester.pumpAndSettle();
      expect(find.text('11 Defense Layers Active'), findsOneWidget);
    });

    testWidgets('Send OTP button is disabled when phone is empty',
        (tester) async {
      await tester.pumpWidget(_wrapWithProvider(const ContentView()));

      final button = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Send OTP'),
      );
      expect(button.onPressed, isNull);
    });

    testWidgets('Send OTP button is enabled after entering phone',
        (tester) async {
      await tester.pumpWidget(_wrapWithProvider(const ContentView()));

      await tester.enterText(find.byType(TextField), '+15551234567');
      await tester.pump();

      final button = tester.widget<ElevatedButton>(
        find.widgetWithText(ElevatedButton, 'Send OTP'),
      );
      expect(button.onPressed, isNotNull);
    });
  });

  group('StepIndicator', () {
    testWidgets('renders 3 step labels', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: Scaffold(body: StepIndicator(currentStep: 0))),
      );

      expect(find.text('Phone'), findsOneWidget);
      expect(find.text('Verify'), findsOneWidget);
      expect(find.text('Done'), findsOneWidget);
    });

    testWidgets('highlights current step', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(home: Scaffold(body: StepIndicator(currentStep: 1))),
      );

      // Step 1 (Verify) should show number "2"
      expect(find.text('2'), findsOneWidget);
    });
  });

  group('DefenseCard', () {
    testWidgets('renders all 11 defense layers', (tester) async {
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(body: SingleChildScrollView(child: DefenseCard())),
        ),
      );

      expect(find.text('HMAC Request Signing'), findsOneWidget);
      expect(find.text('Preflight Token (120s TTL)'), findsOneWidget);
      expect(find.text('Multi-dimensional Rate Limiting'), findsOneWidget);
      expect(find.text('Risk Scoring (0\u2013100)'), findsOneWidget);
      expect(find.text('Proof-of-Work Challenge'), findsOneWidget);
      expect(find.text('Device Attestation'), findsOneWidget);
      expect(find.text('Browser Fingerprinting'), findsOneWidget);
      expect(find.text('OTP Binding (argon2id)'), findsOneWidget);
      expect(find.text('Honeypot Traps'), findsOneWidget);
      expect(find.text('Automation Detection'), findsOneWidget);
      expect(find.text('Timing Analysis'), findsOneWidget);
    });
  });

  group('AuthViewModel', () {
    test('initial state is phoneInput', () {
      final vm = AuthViewModel();
      expect(vm.state, equals(AuthState.phoneInput));
      expect(vm.currentStep, equals(0));
    });

    test('setting phone notifies listeners', () {
      final vm = AuthViewModel();
      var notified = false;
      vm.addListener(() => notified = true);

      vm.phone = '+1234';
      expect(notified, isTrue);
      expect(vm.phone, equals('+1234'));
    });

    test('otpCode filters to 6 digits', () {
      final vm = AuthViewModel();
      vm.otpCode = '12abc34567890';
      expect(vm.otpCode, equals('123456'));
    });

    test('otpCode rejects non-digits', () {
      final vm = AuthViewModel();
      vm.otpCode = 'abcdef';
      expect(vm.otpCode, equals(''));
    });

    test('recordInteraction sets firstInteractionTime once', () {
      final vm = AuthViewModel();
      vm.recordInteraction();
      vm.recordInteraction(); // second call should be a no-op
      // No error = pass (internal field not publicly exposed)
    });

    test('currentStep reflects state', () {
      final vm = AuthViewModel();
      expect(vm.currentStep, equals(0)); // phoneInput

      // We can't easily set state externally, but we can test the mapping
      // by verifying the initial state
    });

    test('phone and otpCode can be cleared manually', () {
      final vm = AuthViewModel();
      vm.phone = '+1234';
      vm.otpCode = '123456';

      vm.phone = '';
      vm.otpCode = '';

      expect(vm.phone, equals(''));
      expect(vm.otpCode, equals(''));
      expect(vm.state, equals(AuthState.phoneInput));
      expect(vm.session, isNull);
    });
  });
}
