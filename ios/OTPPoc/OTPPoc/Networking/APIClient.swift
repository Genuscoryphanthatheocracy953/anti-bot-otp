import Foundation

enum APIError: LocalizedError {
    case serverError(code: String, message: String, retryAfter: Int?)
    case networkError(Error)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .serverError(let code, let message, _):
            return "\(code): \(message)"
        case .networkError(let error):
            return "Network error: \(error.localizedDescription)"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        }
    }
}

final class APIClient {
    static let shared = APIClient()

    // iOS simulator shares host network — localhost works
    private let baseURL = URL(string: "http://localhost:3000")!
    private let session = URLSession.shared
    private let tokenManager = TokenManager.shared
    private let encoder: JSONEncoder = {
        let e = JSONEncoder()
        e.outputFormatting = .sortedKeys
        return e
    }()
    private let decoder = JSONDecoder()

    func request<T: Decodable>(
        method: String,
        path: String,
        body: (any Encodable)? = nil,
        extraHeaders: [String: String] = [:]
    ) async throws -> T {
        let url = baseURL.appendingPathComponent(path)
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue(tokenManager.deviceId, forHTTPHeaderField: "X-Device-Id")
        request.setValue("mobile", forHTTPHeaderField: "X-Channel")

        // Body
        var bodyData: Data?
        if let body {
            bodyData = try encoder.encode(body)
            request.httpBody = bodyData
        }

        // HMAC signing
        let (signature, timestamp, nonce) = HMACSigner.sign(
            method: method,
            path: path,
            body: bodyData
        )
        request.setValue(signature, forHTTPHeaderField: "X-Signature")
        request.setValue(timestamp, forHTTPHeaderField: "X-Timestamp")
        request.setValue(nonce, forHTTPHeaderField: "X-Nonce")

        // Auth token
        if let accessToken = tokenManager.accessToken {
            request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")
        }

        // Attestation token for mobile
        if let attestJwt = tokenManager.attestationJwt {
            request.setValue(attestJwt, forHTTPHeaderField: "X-Attestation-Token")
        }

        // Extra headers
        for (key, value) in extraHeaders {
            request.setValue(value, forHTTPHeaderField: key)
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError(URLError(.badServerResponse))
        }

        let apiResponse: ApiResponse<T>
        do {
            apiResponse = try decoder.decode(ApiResponse<T>.self, from: data)
        } catch {
            throw APIError.decodingError(error)
        }

        if !apiResponse.success, let error = apiResponse.error {
            throw APIError.serverError(
                code: error.code,
                message: error.message,
                retryAfter: error.retry_after
            )
        }

        guard let result = apiResponse.data else {
            throw APIError.serverError(code: "NO_DATA", message: "No data in response", retryAfter: nil)
        }

        return result
    }

    // Convenience methods

    func preflight(clientSignals: ClientSignals? = nil) async throws -> PreflightResponse {
        let body = PreflightRequest(
            channel: "mobile",
            device_id: tokenManager.deviceId,
            fingerprint: nil,
            client_signals: clientSignals
        )
        return try await request(method: "POST", path: "/v1/auth/preflight", body: body)
    }

    func sendOtp(
        phone: String,
        purpose: String,
        preflightToken: String,
        powSolution: PowSolutionRequest? = nil,
        captchaToken: String? = nil
    ) async throws -> OtpSendResponse {
        let body = OtpSendRequest(
            phone: phone,
            purpose: purpose,
            pow_solution: powSolution,
            captcha_token: captchaToken
        )
        return try await request(
            method: "POST",
            path: "/v1/auth/otp/send",
            body: body,
            extraHeaders: ["X-Preflight-Token": preflightToken]
        )
    }

    func verifyOtp(phone: String, code: String, challengeId: String) async throws -> OtpVerifyResponse {
        let body = OtpVerifyRequest(
            phone: phone,
            code: code,
            challenge_id: challengeId,
            device_id: tokenManager.deviceId
        )
        return try await request(method: "POST", path: "/v1/auth/otp/verify", body: body)
    }

    func getSession() async throws -> SessionMeResponse {
        return try await request(method: "GET", path: "/v1/auth/session/me")
    }
}
