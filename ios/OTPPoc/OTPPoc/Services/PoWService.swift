import Foundation
import CryptoKit

enum PoWService {
    /// Finds a value where SHA256(nonce + value) has `difficulty` leading zero bits.
    /// Runs on a background thread to avoid blocking the UI.
    static func solve(nonce: String, difficulty: Int) async -> String {
        await withCheckedContinuation { continuation in
            DispatchQueue.global(qos: .userInitiated).async {
                var counter: UInt64 = 0
                while true {
                    let candidate = "\(nonce)\(counter)"
                    let data = Data(candidate.utf8)
                    let hash = SHA256.hash(data: data)
                    let hashBytes = Array(hash)

                    if hasLeadingZeroBits(hashBytes, count: difficulty) {
                        continuation.resume(returning: String(counter))
                        return
                    }
                    counter += 1
                }
            }
        }
    }

    private static func hasLeadingZeroBits(_ bytes: [UInt8], count: Int) -> Bool {
        var bitsChecked = 0
        for byte in bytes {
            guard bitsChecked < count else { return true }
            for bit in stride(from: 7, through: 0, by: -1) {
                guard bitsChecked < count else { return true }
                if (byte >> bit) & 1 != 0 {
                    return false
                }
                bitsChecked += 1
            }
        }
        return bitsChecked >= count
    }
}
