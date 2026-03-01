import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../view_models/auth_view_model.dart';
import 'components/defense_card.dart';
import 'components/step_indicator.dart';
import 'loading_view.dart';
import 'otp_verify_view.dart';
import 'phone_input_view.dart';
import 'session_view.dart';
import 'theme.dart';

class ContentView extends StatelessWidget {
  const ContentView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.bg,
      body: Consumer<AuthViewModel>(
        builder: (context, viewModel, _) {
          return CustomScrollView(
            slivers: [
              // Dark gradient hero header
              SliverToBoxAdapter(
                child: Container(
                  height: 120,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [AppColors.brand900, AppColors.brand800],
                    ),
                  ),
                  alignment: Alignment.bottomLeft,
                  padding:
                      const EdgeInsets.only(left: 20, bottom: 16, right: 20),
                  child: SafeArea(
                    bottom: false,
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: AppColors.brand500.withValues(alpha: 0.3),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          alignment: Alignment.center,
                          child: const Icon(
                            Icons.shield,
                            color: AppColors.brand400,
                            size: 20,
                          ),
                        ),
                        const SizedBox(width: 12),
                        const Text(
                          'OTP Auth PoC',
                          style: TextStyle(
                            fontSize: 22,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // Step indicator
              SliverToBoxAdapter(
                child: StepIndicator(currentStep: viewModel.currentStep),
              ),

              // State-specific content
              SliverToBoxAdapter(
                child: AnimatedSwitcher(
                  duration: const Duration(milliseconds: 300),
                  switchInCurve: Curves.easeInOut,
                  switchOutCurve: Curves.easeInOut,
                  child: _buildContent(viewModel),
                ),
              ),

              // Spacing
              const SliverToBoxAdapter(
                child: SizedBox(height: AppSpacing.sectionGap),
              ),

              // Defense card
              const SliverToBoxAdapter(
                child: DefenseCard(),
              ),

              // Bottom padding
              const SliverToBoxAdapter(
                child: SizedBox(height: 40),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildContent(AuthViewModel viewModel) {
    switch (viewModel.state) {
      case AuthState.phoneInput:
      case AuthState.error:
        return PhoneInputView(key: const ValueKey('phone'));
      case AuthState.runningPreflight:
      case AuthState.solvingPoW:
      case AuthState.sendingOtp:
        return LoadingView(
          key: const ValueKey('loading'),
          message: viewModel.statusMessage,
        );
      case AuthState.otpSent:
      case AuthState.verifyingOtp:
        return OtpVerifyView(key: const ValueKey('otp'));
      case AuthState.authenticated:
        return SessionView(key: const ValueKey('session'));
    }
  }
}
