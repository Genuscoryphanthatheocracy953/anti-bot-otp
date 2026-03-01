import SwiftUI

struct DefenseCard: View {
    private let defenses: [(icon: String, label: String)] = [
        ("signature", "HMAC Request Signing"),
        ("clock.badge.checkmark", "Preflight Token (120s TTL)"),
        ("gauge.with.dots.needle.bottom.50percent", "Multi-dimensional Rate Limiting"),
        ("chart.bar.fill", "Risk Scoring (0-100)"),
        ("hammer.fill", "Proof-of-Work Challenge"),
        ("person.badge.shield.checkmark", "Device Attestation"),
        ("hand.raised.fingers.spread", "Browser Fingerprinting"),
        ("lock.fill", "OTP Binding (argon2id)"),
        ("rectangle.dashed", "Honeypot Traps"),
        ("eye.trianglebadge.exclamationmark", "Automation Detection"),
        ("timer", "Timing Analysis"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(spacing: 8) {
                Image(systemName: "shield.checkered")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(AppColors.defenseIcon)
                Text("ACTIVE DEFENSES")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(AppColors.defenseIcon)
                    .tracking(1.2)
            }
            .padding(.bottom, 2)

            ForEach(Array(defenses.enumerated()), id: \.offset) { _, defense in
                HStack(spacing: 12) {
                    ZStack {
                        Circle()
                            .fill(AppColors.brand100)
                            .frame(width: 32, height: 32)
                        Image(systemName: defense.icon)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundColor(AppColors.brand500)
                    }

                    Text(defense.label)
                        .font(.system(size: 13, weight: .medium))
                        .foregroundColor(AppColors.textPrimary)
                }
            }
        }
        .padding(AppSpacing.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(AppColors.defenseBg)
        .cornerRadius(AppSpacing.cardRadius)
        .overlay(
            RoundedRectangle(cornerRadius: AppSpacing.cardRadius)
                .stroke(AppColors.defenseBorder, lineWidth: 1)
        )
    }
}
