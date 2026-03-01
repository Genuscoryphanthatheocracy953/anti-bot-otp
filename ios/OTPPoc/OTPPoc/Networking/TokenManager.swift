import Foundation

final class TokenManager {
    static let shared = TokenManager()

    private let accessTokenKey = "otppoc.access_token"
    private let refreshTokenKey = "otppoc.refresh_token"
    private let attestationTokenKey = "otppoc.attestation_jwt"
    private let deviceIdKey = "otppoc.device_id"

    var accessToken: String? {
        get { KeychainHelper.loadString(key: accessTokenKey) }
        set {
            if let value = newValue {
                _ = KeychainHelper.saveString(key: accessTokenKey, value: value)
            } else {
                KeychainHelper.delete(key: accessTokenKey)
            }
        }
    }

    var refreshToken: String? {
        get { KeychainHelper.loadString(key: refreshTokenKey) }
        set {
            if let value = newValue {
                _ = KeychainHelper.saveString(key: refreshTokenKey, value: value)
            } else {
                KeychainHelper.delete(key: refreshTokenKey)
            }
        }
    }

    var attestationJwt: String? {
        get { KeychainHelper.loadString(key: attestationTokenKey) }
        set {
            if let value = newValue {
                _ = KeychainHelper.saveString(key: attestationTokenKey, value: value)
            } else {
                KeychainHelper.delete(key: attestationTokenKey)
            }
        }
    }

    var deviceId: String {
        if let existing = KeychainHelper.loadString(key: deviceIdKey) {
            return existing
        }
        let newId = UUID().uuidString
        _ = KeychainHelper.saveString(key: deviceIdKey, value: newId)
        return newId
    }

    func clearAll() {
        accessToken = nil
        refreshToken = nil
        attestationJwt = nil
    }
}
