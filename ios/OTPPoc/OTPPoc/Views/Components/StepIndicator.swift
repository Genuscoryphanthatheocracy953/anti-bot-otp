import SwiftUI

struct StepIndicator: View {
    let currentStep: Int
    private let steps = ["Phone", "Verify", "Done"]

    var body: some View {
        HStack(spacing: 0) {
            ForEach(Array(steps.enumerated()), id: \.offset) { index, label in
                if index > 0 {
                    Rectangle()
                        .fill(index <= currentStep ? AppColors.brand500 : AppColors.border)
                        .frame(height: 2)
                        .animation(.easeInOut(duration: 0.3), value: currentStep)
                }

                VStack(spacing: 6) {
                    ZStack {
                        Circle()
                            .fill(stepColor(for: index))
                            .frame(width: 28, height: 28)

                        if index < currentStep {
                            Image(systemName: "checkmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(.white)
                        } else {
                            Text("\(index + 1)")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundColor(index == currentStep ? .white : AppColors.textMuted)
                        }
                    }
                    .animation(.spring(response: 0.4, dampingFraction: 0.7), value: currentStep)

                    Text(label)
                        .font(.system(size: 11, weight: index == currentStep ? .semibold : .regular))
                        .foregroundColor(index <= currentStep ? AppColors.textPrimary : AppColors.textMuted)
                }
            }
        }
        .padding(.horizontal, 32)
        .padding(.vertical, 8)
    }

    private func stepColor(for index: Int) -> Color {
        if index < currentStep { return AppColors.success }
        if index == currentStep { return AppColors.brand500 }
        return AppColors.border
    }
}
