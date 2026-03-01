import Foundation

enum PhoneFormatter {
    static func normalizeToE164(_ phone: String) -> String {
        var cleaned = phone.replacingOccurrences(of: "[\\s\\-\\(\\)]", with: "", options: .regularExpression)
        if !cleaned.hasPrefix("+") {
            cleaned = "+" + cleaned
        }
        return cleaned
    }

    static func isValidE164(_ phone: String) -> Bool {
        let pattern = #"^\+[1-9]\d{6,14}$"#
        return phone.range(of: pattern, options: .regularExpression) != nil
    }
}
