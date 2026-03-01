import Foundation
import SwiftUI

enum AuthState: Equatable {
    case phoneInput
    case runningPreflight
    case solvingPoW
    case sendingOtp
    case otpSent
    case verifyingOtp
    case authenticated
    case error(String)

    static func == (lhs: AuthState, rhs: AuthState) -> Bool {
        switch (lhs, rhs) {
        case (.phoneInput, .phoneInput),
             (.runningPreflight, .runningPreflight),
             (.solvingPoW, .solvingPoW),
             (.sendingOtp, .sendingOtp),
             (.otpSent, .otpSent),
             (.verifyingOtp, .verifyingOtp),
             (.authenticated, .authenticated):
            return true
        case (.error(let a), .error(let b)):
            return a == b
        default:
            return false
        }
    }
}

@MainActor
final class AuthViewModel: ObservableObject {
    @Published var state: AuthState = .phoneInput
    @Published var phone: String = ""
    @Published var otpCode: String = ""
    @Published var statusMessage: String = ""
    @Published var session: SessionMeResponse?

    private var challengeId: String?
    private var preflightToken: String?
    private let api = APIClient.shared
    private let viewLoadTime = Date()
    private var firstInteractionTime: Date?

    /// Call when the user first interacts with the phone field
    func recordInteraction() {
        if firstInteractionTime == nil {
            firstInteractionTime = Date()
        }
    }

    func startAuth() async {
        guard !phone.isEmpty else { return }

        let normalized = PhoneFormatter.normalizeToE164(phone)
        guard PhoneFormatter.isValidE164(normalized) else {
            state = .error("Invalid phone number. Use E.164 format (e.g., +15551234567)")
            return
        }

        do {
            // Step 0: Attestation (mobile requirement)
            state = .runningPreflight
            statusMessage = "Running device attestation..."

            if TokenManager.shared.attestationJwt == nil {
                _ = try await AttestationService.shared.attest()
            }

            // Step 1: Preflight — run integrity checks and build client signals
            statusMessage = "Running preflight..."
            let integrity = IntegrityService.shared.check()
            let now = Date()
            let clientSignals = ClientSignals(
                automation_signals: ClientSignals.AutomationSignals(
                    jailbroken: integrity.jailbroken,
                    debugger_attached: integrity.debuggerAttached,
                    suspicious_dylibs: integrity.suspiciousDylibs
                ),
                timing: ClientSignals.TimingData(
                    page_load_ts: Int64(viewLoadTime.timeIntervalSince1970 * 1000),
                    first_interaction_ts: firstInteractionTime.map { Int64($0.timeIntervalSince1970 * 1000) },
                    form_submit_ts: Int64(now.timeIntervalSince1970 * 1000)
                )
            )
            let pf = try await api.preflight(clientSignals: clientSignals)
            preflightToken = pf.token
            statusMessage = "Risk score: \(pf.risk_score)"

            // Step 2: PoW if required
            var powSolution: PowSolutionRequest?
            if pf.requires_pow == true, let challenge = pf.pow_challenge {
                state = .solvingPoW
                statusMessage = "Solving proof-of-work (difficulty: \(challenge.difficulty))..."
                let solution = await PoWService.solve(nonce: challenge.nonce, difficulty: challenge.difficulty)
                powSolution = PowSolutionRequest(
                    nonce: challenge.nonce,
                    solution: solution,
                    challenge_id: challenge.challenge_id
                )
                statusMessage = "PoW solved!"
            }

            // Step 3: Send OTP
            state = .sendingOtp
            statusMessage = "Sending OTP..."
            let otpResp = try await api.sendOtp(
                phone: normalized,
                purpose: "login",
                preflightToken: pf.token,
                powSolution: powSolution,
                captchaToken: pf.requires_captcha == true ? "pass" : nil
            )

            challengeId = otpResp.challenge_id
            state = .otpSent
            statusMessage = "OTP sent! Check Telegram or backend console."
        } catch {
            state = .error(error.localizedDescription)
        }
    }

    func verifyOtp() async {
        guard let challengeId else {
            state = .error("No challenge ID")
            return
        }

        let normalized = PhoneFormatter.normalizeToE164(phone)

        do {
            state = .verifyingOtp
            statusMessage = "Verifying OTP..."

            let result = try await api.verifyOtp(
                phone: normalized,
                code: otpCode,
                challengeId: challengeId
            )

            // Store tokens
            TokenManager.shared.accessToken = result.access_token
            if let refresh = result.refresh_token {
                TokenManager.shared.refreshToken = refresh
            }

            // Fetch session
            statusMessage = "Fetching session..."
            let sessionData = try await api.getSession()
            session = sessionData
            state = .authenticated
            statusMessage = ""
        } catch {
            state = .otpSent
            statusMessage = error.localizedDescription
        }
    }

    func reset() {
        state = .phoneInput
        phone = ""
        otpCode = ""
        statusMessage = ""
        session = nil
        challengeId = nil
        preflightToken = nil
        TokenManager.shared.clearAll()
    }
}
