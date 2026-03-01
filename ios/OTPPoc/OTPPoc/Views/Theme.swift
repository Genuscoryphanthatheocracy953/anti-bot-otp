import SwiftUI

enum AppColors {
    static let brand900 = Color(red: 0.059, green: 0.090, blue: 0.165)
    static let brand800 = Color(red: 0.118, green: 0.161, blue: 0.231)
    static let brand500 = Color(red: 0.231, green: 0.510, blue: 0.965)
    static let brand400 = Color(red: 0.376, green: 0.647, blue: 0.980)
    static let brand100 = Color(red: 0.859, green: 0.910, blue: 0.996)
    static let surface = Color.white
    static let bg = Color(red: 0.973, green: 0.980, blue: 0.988)
    static let textPrimary = Color(red: 0.059, green: 0.090, blue: 0.165)
    static let textSecondary = Color(red: 0.392, green: 0.455, blue: 0.545)
    static let textMuted = Color(red: 0.580, green: 0.639, blue: 0.722)
    static let border = Color(red: 0.886, green: 0.910, blue: 0.941)
    static let success = Color(red: 0.063, green: 0.725, blue: 0.506)
    static let successBg = Color(red: 0.925, green: 0.992, blue: 0.961)
    static let error = Color(red: 0.937, green: 0.267, blue: 0.267)
    static let errorBg = Color(red: 0.996, green: 0.949, blue: 0.949)
    static let defenseBg = Color(red: 0.941, green: 0.976, blue: 1.0)
    static let defenseBorder = Color(red: 0.729, green: 0.902, blue: 0.992)
    static let defenseIcon = Color(red: 0.055, green: 0.647, blue: 0.914)

    static let heroGradient = LinearGradient(
        colors: [brand900, brand800],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

enum AppSpacing {
    static let cardRadius: CGFloat = 16
    static let cardPadding: CGFloat = 24
    static let inputRadius: CGFloat = 12
    static let buttonRadius: CGFloat = 12
    static let buttonHeight: CGFloat = 50
    static let sectionGap: CGFloat = 24
    static let innerGap: CGFloat = 16
}
