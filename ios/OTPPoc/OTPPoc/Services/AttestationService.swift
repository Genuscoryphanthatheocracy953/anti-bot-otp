import Foundation
import CryptoKit

/**
 Mobile Attestation Stub

 In production, replace with:
   - iOS: App Attest (DCAppAttestService)
   - Android: Play Integrity API

 This PoC uses a P256 keypair stored in Keychain.
 */
final class AttestationService {
    static let shared = AttestationService()

    private let privateKeyTag = "com.otppoc.attestation.private"
    private let publicKeyTag = "com.otppoc.attestation.public"

    private var privateKey: P256.Signing.PrivateKey {
        if let keyData = KeychainHelper.load(key: privateKeyTag) {
            return try! P256.Signing.PrivateKey(rawRepresentation: keyData)
        }
        let key = P256.Signing.PrivateKey()
        _ = KeychainHelper.save(key: privateKeyTag, data: key.rawRepresentation)
        return key
    }

    var publicKeyPEM: String {
        let pubKey = privateKey.publicKey
        let rawKey = pubKey.x963Representation

        // Wrap raw x963 key in ASN.1 SPKI structure for Node.js crypto compatibility
        // SPKI header for P256 uncompressed public key (26 bytes prefix)
        let spkiHeader: [UInt8] = [
            0x30, 0x59,             // SEQUENCE (89 bytes)
            0x30, 0x13,             // SEQUENCE (19 bytes) - AlgorithmIdentifier
            0x06, 0x07,             // OID (7 bytes) - id-ecPublicKey
            0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x02, 0x01,
            0x06, 0x08,             // OID (8 bytes) - prime256v1
            0x2A, 0x86, 0x48, 0xCE, 0x3D, 0x03, 0x01, 0x07,
            0x03, 0x42, 0x00,       // BIT STRING (66 bytes, 0 unused bits)
        ]
        var spkiData = Data(spkiHeader)
        spkiData.append(rawKey)

        let base64 = spkiData.base64EncodedString(options: .lineLength64Characters)
        return "-----BEGIN PUBLIC KEY-----\n\(base64)\n-----END PUBLIC KEY-----"
    }

    func signChallenge(_ challenge: String) throws -> String {
        let data = Data(challenge.utf8)
        let signature = try privateKey.signature(for: data)
        return signature.derRepresentation.base64EncodedString()
    }

    /// Full attestation flow: get challenge -> sign -> verify -> receive JWT
    func attest() async throws -> String {
        let api = APIClient.shared

        // Step 1: Get challenge
        let challengeResp: AttestationChallengeResponse = try await api.request(
            method: "POST",
            path: "/v1/device/attest",
            body: ["device_id": TokenManager.shared.deviceId]
        )

        // Step 2: Sign challenge
        let signedResponse = try signChallenge(challengeResp.challenge)

        // Step 3: Verify attestation
        let verifyBody = AttestationVerifyRequest(
            challenge_id: challengeResp.challenge_id,
            device_id: TokenManager.shared.deviceId,
            challenge: challengeResp.challenge,
            signed_response: signedResponse,
            public_key: publicKeyPEM,
            app_id: "com.otppoc.OTPPoc"
        )

        let verifyResp: AttestationVerifyResponse = try await api.request(
            method: "POST",
            path: "/v1/device/attest/verify",
            body: verifyBody
        )

        // Store JWT
        TokenManager.shared.attestationJwt = verifyResp.attestation_jwt
        return verifyResp.attestation_jwt
    }
}
