import SwiftUI

struct PhoneInputView: View {
    @ObservedObject var viewModel: AuthViewModel

    var body: some View {
        VStack(spacing: AppSpacing.innerGap) {
            VStack(alignment: .leading, spacing: 8) {
                Text("Enter your phone number")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(AppColors.textPrimary)

                Text("We'll send a one-time code to verify your identity.")
                    .font(.system(size: 13))
                    .foregroundColor(AppColors.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            HStack(spacing: 10) {
                Image(systemName: "phone.fill")
                    .foregroundColor(AppColors.textMuted)
                    .font(.system(size: 15))

                TextField("+1 555 123 4567", text: $viewModel.phone)
                    .keyboardType(.phonePad)
                    .textContentType(.telephoneNumber)
                    .font(.system(size: 17))
                    .onChange(of: viewModel.phone) {
                        viewModel.recordInteraction()
                    }
            }
            .padding(14)
            .background(AppColors.surface)
            .cornerRadius(AppSpacing.inputRadius)
            .overlay(
                RoundedRectangle(cornerRadius: AppSpacing.inputRadius)
                    .stroke(AppColors.border, lineWidth: 1)
            )

            Button {
                Task { await viewModel.startAuth() }
            } label: {
                Text("Send OTP")
                    .font(.system(size: 16, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .frame(height: AppSpacing.buttonHeight)
                    .background(viewModel.phone.isEmpty ? AppColors.textMuted : AppColors.brand500)
                    .foregroundColor(.white)
                    .cornerRadius(AppSpacing.buttonRadius)
            }
            .disabled(viewModel.phone.isEmpty)

            if case .error(let message) = viewModel.state {
                HStack(spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundColor(AppColors.error)
                        .font(.system(size: 14))
                    Text(message)
                        .font(.system(size: 13))
                        .foregroundColor(AppColors.error)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(12)
                .background(AppColors.errorBg)
                .cornerRadius(AppSpacing.inputRadius)
            }
        }
        .padding(AppSpacing.cardPadding)
        .background(AppColors.surface)
        .cornerRadius(AppSpacing.cardRadius)
        .shadow(color: .black.opacity(0.06), radius: 12, x: 0, y: 4)
        .padding(.horizontal, 20)
    }
}
