import SwiftUI

struct ContentView: View {
    @StateObject private var viewModel = AuthViewModel()

    var body: some View {
        ZStack {
            AppColors.bg.ignoresSafeArea()

            VStack(spacing: 0) {
                // Dark gradient hero header
                ZStack {
                    AppColors.heroGradient
                        .ignoresSafeArea(edges: .top)

                    VStack(spacing: 4) {
                        Image(systemName: "lock.shield.fill")
                            .font(.system(size: 28))
                            .foregroundColor(.white.opacity(0.9))
                        Text("OTP Auth PoC")
                            .font(.system(size: 20, weight: .bold))
                            .foregroundColor(.white)
                        Text("Layered Anti-Bot Defenses")
                            .font(.system(size: 12, weight: .medium))
                            .foregroundColor(.white.opacity(0.6))
                    }
                    .padding(.top, 8)
                    .padding(.bottom, 20)
                }
                .frame(height: 120)
                .clipShape(
                    RoundedCorner(radius: 24, corners: [.bottomLeft, .bottomRight])
                )

                ScrollView {
                    VStack(spacing: AppSpacing.sectionGap) {
                        // Step indicator
                        StepIndicator(currentStep: currentStep)
                            .padding(.top, AppSpacing.sectionGap)

                        // State-specific content
                        Group {
                            switch viewModel.state {
                            case .phoneInput, .error:
                                PhoneInputView(viewModel: viewModel)
                            case .runningPreflight, .solvingPoW, .sendingOtp:
                                LoadingView(viewModel: viewModel)
                            case .otpSent, .verifyingOtp:
                                OTPVerifyView(viewModel: viewModel)
                            case .authenticated:
                                SessionView(viewModel: viewModel)
                            }
                        }
                        .transition(.asymmetric(
                            insertion: .move(edge: .trailing).combined(with: .opacity),
                            removal: .move(edge: .leading).combined(with: .opacity)
                        ))
                        .animation(.spring(response: 0.4, dampingFraction: 0.8), value: viewModel.state)

                        // Defense card visible on all screens
                        DefenseCard()
                            .padding(.horizontal, 20)
                    }
                    .padding(.bottom, 32)
                }
            }
        }
    }

    private var currentStep: Int {
        switch viewModel.state {
        case .phoneInput, .error:
            return 0
        case .runningPreflight, .solvingPoW, .sendingOtp, .otpSent, .verifyingOtp:
            return 1
        case .authenticated:
            return 2
        }
    }
}

// Custom rounded corner shape for hero header
struct RoundedCorner: Shape {
    var radius: CGFloat
    var corners: UIRectCorner

    func path(in rect: CGRect) -> Path {
        let path = UIBezierPath(
            roundedRect: rect,
            byRoundingCorners: corners,
            cornerRadii: CGSize(width: radius, height: radius)
        )
        return Path(path.cgPath)
    }
}

struct LoadingView: View {
    @ObservedObject var viewModel: AuthViewModel
    @State private var dotIndex = 0

    var body: some View {
        VStack(spacing: 20) {
            HStack(spacing: 8) {
                ForEach(0..<3) { i in
                    Circle()
                        .fill(AppColors.brand500)
                        .frame(width: 10, height: 10)
                        .scaleEffect(dotIndex == i ? 1.3 : 0.7)
                        .opacity(dotIndex == i ? 1 : 0.4)
                        .animation(.easeInOut(duration: 0.4), value: dotIndex)
                }
            }
            .onAppear {
                Timer.scheduledTimer(withTimeInterval: 0.4, repeats: true) { _ in
                    dotIndex = (dotIndex + 1) % 3
                }
            }

            Text(viewModel.statusMessage)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(AppColors.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(AppSpacing.cardPadding)
        .frame(maxWidth: .infinity)
        .background(AppColors.surface)
        .cornerRadius(AppSpacing.cardRadius)
        .shadow(color: .black.opacity(0.06), radius: 12, x: 0, y: 4)
        .padding(.horizontal, 20)
    }
}
