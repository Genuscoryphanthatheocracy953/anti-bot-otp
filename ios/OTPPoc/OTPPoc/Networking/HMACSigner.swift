import Foundation
import CryptoKit

enum HMACSigner {
    // PoC: Key embedded in app. In production, derive from attestation or fetch securely.
    private static let clientKey = "d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4"

    static func sign(method: String, path: String, body: Data?) -> (signature: String, timestamp: String, nonce: String) {
        let timestamp = String(Int(Date().timeIntervalSince1970))
        let nonce = UUID().uuidString

        let bodyHash = sha256Hex(data: body ?? Data())
        let payload = "\(method)\n\(path)\n\(timestamp)\n\(bodyHash)"

        let key = SymmetricKey(data: Data(clientKey.utf8))
        let signature = HMAC<SHA256>.authenticationCode(for: Data(payload.utf8), using: key)
        let signatureHex = signature.map { String(format: "%02x", $0) }.joined()

        return (signatureHex, timestamp, nonce)
    }

    private static func sha256Hex(data: Data) -> String {
        let digest = SHA256.hash(data: data)
        return digest.map { String(format: "%02x", $0) }.joined()
    }
}
