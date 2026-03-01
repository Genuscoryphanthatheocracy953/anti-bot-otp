import Foundation

struct AttestationChallengeResponse: Decodable {
    let challenge: String
    let challenge_id: String
}

struct AttestationVerifyRequest: Encodable {
    let challenge_id: String
    let device_id: String
    let challenge: String
    let signed_response: String
    let public_key: String
    let app_id: String
}

struct AttestationVerifyResponse: Decodable {
    let attestation_jwt: String
    let expires_in: Int
    let note: String?
}
