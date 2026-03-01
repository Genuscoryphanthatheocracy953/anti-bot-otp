import SwiftUI

struct SessionView: View {
    @ObservedObject var viewModel: AuthViewModel
    @State private var showCheck = false
    @State private var showRows = false

    var body: some View {
        VStack(spacing: AppSpacing.innerGap) {
            // Animated success checkmark
            ZStack {
                Circle()
                    .fill(AppColors.successBg)
                    .frame(width: 72, height: 72)
                Circle()
                    .fill(AppColors.success)
                    .frame(width: 56, height: 56)
                Image(systemName: "checkmark")
                    .font(.system(size: 28, weight: .bold))
                    .foregroundColor(.white)
            }
            .scaleEffect(showCheck ? 1 : 0.3)
            .opacity(showCheck ? 1 : 0)
            .animation(.spring(response: 0.5, dampingFraction: 0.6), value: showCheck)

            Text("Authenticated!")
                .font(.system(size: 20, weight: .bold))
                .foregroundColor(AppColors.textPrimary)

            if let session = viewModel.session {
                VStack(spacing: 0) {
                    SessionInfoRow(icon: "phone.fill", label: "Phone", value: session.phone, delay: 0)
                    Divider().padding(.leading, 44)
                    SessionInfoRow(icon: "laptopcomputer", label: "Device", value: String(session.device_id.prefix(8)) + "...", delay: 0.05)
                    Divider().padding(.leading, 44)
                    SessionInfoRow(icon: "antenna.radiowaves.left.and.right", label: "Channel", value: session.channel, delay: 0.1)
                    Divider().padding(.leading, 44)
                    SessionInfoRow(icon: "clock.fill", label: "Issued", value: formatTimestamp(session.issued_at), delay: 0.15)
                    Divider().padding(.leading, 44)
                    SessionInfoRow(icon: "clock.badge.xmark", label: "Expires", value: formatTimestamp(session.expires_at), delay: 0.2)
                }
                .padding(.vertical, 4)
                .opacity(showRows ? 1 : 0)
                .offset(y: showRows ? 0 : 10)
                .animation(.easeOut(duration: 0.4).delay(0.3), value: showRows)
            }

            Button {
                viewModel.reset()
            } label: {
                Text("Sign Out")
                    .font(.system(size: 14, weight: .medium))
                    .frame(maxWidth: .infinity)
                    .frame(height: 40)
                    .foregroundColor(AppColors.textSecondary)
                    .background(AppColors.bg)
                    .cornerRadius(AppSpacing.buttonRadius)
                    .overlay(
                        RoundedRectangle(cornerRadius: AppSpacing.buttonRadius)
                            .stroke(AppColors.border, lineWidth: 1)
                    )
            }
        }
        .padding(AppSpacing.cardPadding)
        .background(AppColors.surface)
        .cornerRadius(AppSpacing.cardRadius)
        .shadow(color: .black.opacity(0.06), radius: 12, x: 0, y: 4)
        .padding(.horizontal, 20)
        .onAppear {
            showCheck = true
            showRows = true
        }
    }

    private func formatTimestamp(_ ts: Int) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(ts))
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .medium
        return formatter.string(from: date)
    }
}

struct SessionInfoRow: View {
    let icon: String
    let label: String
    let value: String
    let delay: Double

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14))
                .foregroundColor(AppColors.brand500)
                .frame(width: 32)
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(.system(size: 11, weight: .medium))
                    .foregroundColor(AppColors.textMuted)
                Text(value)
                    .font(.system(size: 13, weight: .medium, design: .monospaced))
                    .foregroundColor(AppColors.textPrimary)
            }
            Spacer()
        }
        .padding(.vertical, 8)
    }
}
