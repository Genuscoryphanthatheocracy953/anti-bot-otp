import Foundation

struct ApiResponse<T: Decodable>: Decodable {
    let success: Bool
    let data: T?
    let error: ApiErrorBody?
}

struct ApiErrorBody: Decodable {
    let code: String
    let message: String
    let retry_after: Int?
}

struct PreflightResponse: Decodable {
    let token: String
    let session_id: String
    let risk_score: Int
    let expires_at: Int
    let pow_challenge: PowChallengeData?
    let requires_pow: Bool?
    let requires_captcha: Bool?
}

struct PowChallengeData: Decodable {
    let nonce: String
    let difficulty: Int
    let challenge_id: String
}

struct OtpSendResponse: Decodable {
    let challenge_id: String
    let expires_at: Int
    let purpose: String
}

struct OtpVerifyResponse: Decodable {
    let access_token: String
    let refresh_token: String?
    let token_type: String
    let expires_in: Int
}

struct SessionMeResponse: Decodable {
    let phone: String
    let device_id: String
    let channel: String
    let issued_at: Int
    let expires_at: Int
}

struct ClientSignals: Encodable {
    let automation_signals: AutomationSignals?
    let timing: TimingData?

    struct AutomationSignals: Encodable {
        let jailbroken: Bool
        let debugger_attached: Bool
        let suspicious_dylibs: Bool
    }

    struct TimingData: Encodable {
        let page_load_ts: Int64
        let first_interaction_ts: Int64?
        let form_submit_ts: Int64
    }
}

struct PreflightRequest: Encodable {
    let channel: String
    let device_id: String
    let fingerprint: [String: String]?
    let client_signals: ClientSignals?
}

struct OtpSendRequest: Encodable {
    let phone: String
    let purpose: String
    let pow_solution: PowSolutionRequest?
    let captcha_token: String?
}

struct PowSolutionRequest: Encodable {
    let nonce: String
    let solution: String
    let challenge_id: String
}

struct OtpVerifyRequest: Encodable {
    let phone: String
    let code: String
    let challenge_id: String
    let device_id: String
}
