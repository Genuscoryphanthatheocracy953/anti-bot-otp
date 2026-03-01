import SwiftUI

struct OTPVerifyView: View {
    @ObservedObject var viewModel: AuthViewModel
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(spacing: AppSpacing.innerGap) {
            VStack(spacing: 8) {
                Text("Enter OTP Code")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(AppColors.textPrimary)

                Text("Check Telegram or backend console for the 6-digit code.")
                    .font(.system(size: 13))
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
            }

            TextField("000000", text: $viewModel.otpCode)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .multilineTextAlignment(.center)
                .font(.system(size: 36, weight: .bold, design: .monospaced))
                .tracking(8)
                .padding(16)
                .background(AppColors.surface)
                .cornerRadius(AppSpacing.inputRadius)
                .overlay(
                    RoundedRectangle(cornerRadius: AppSpacing.inputRadius)
                        .stroke(isFocused ? AppColors.brand500 : AppColors.border, lineWidth: isFocused ? 2 : 1)
                )
                .focused($isFocused)
                .onChange(of: viewModel.otpCode) { _, newValue in
                    viewModel.otpCode = String(newValue.filter(\.isNumber).prefix(6))
                }

            Button {
                Task { await viewModel.verifyOtp() }
            } label: {
                HStack(spacing: 8) {
                    if viewModel.state == .verifyingOtp {
                        ProgressView()
                            .tint(.white)
                            .scaleEffect(0.9)
                    }
                    Text(viewModel.state == .verifyingOtp ? "Verifying..." : "Verify OTP")
                }
                .font(.system(size: 16, weight: .semibold))
                .frame(maxWidth: .infinity)
                .frame(height: AppSpacing.buttonHeight)
                .background(viewModel.otpCode.count == 6 ? AppColors.brand500 : AppColors.textMuted)
                .foregroundColor(.white)
                .cornerRadius(AppSpacing.buttonRadius)
            }
            .disabled(viewModel.otpCode.count != 6 || viewModel.state == .verifyingOtp)

            if !viewModel.statusMessage.isEmpty {
                Text(viewModel.statusMessage)
                    .font(.system(size: 13))
                    .foregroundColor(AppColors.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .padding(AppSpacing.cardPadding)
        .background(AppColors.surface)
        .cornerRadius(AppSpacing.cardRadius)
        .shadow(color: .black.opacity(0.06), radius: 12, x: 0, y: 4)
        .padding(.horizontal, 20)
        .onAppear { isFocused = true }
    }
}
