import SwiftUI

struct Theme {
    // Backgrounds
    static let bgBase      = Color(hex: "0a0a0a")   // dark charcoal
    static let bgSurface   = Color(hex: "111111")   // panels, sidebar
    static let bgRaised    = Color(hex: "161616")   // cards, input box
    static let bgHover     = Color(hex: "1a1a1a")   // hover states
    static let bgActive    = Color(hex: "222222")   // active states

    // Text
    static let textPrimary   = Color(hex: "ededed")   // off-white
    static let textSecondary = Color(hex: "a1a1a1")   // muted grey
    static let textMuted     = Color(hex: "6b6b6b")   // dark grey
    static let textCode      = Color(hex: "b4c2d4")   // code text tint

    // Accent — Muted Slate Blue (Geist Minimal Style)
    static let accent        = Color(hex: "7a8eaa")   // muted slate blue
    static let accentBright  = Color(hex: "9ab0ce")   // hover state
    static let accentDim     = Color(hex: "344256")   // background accent
    static let accentGlow    = Color(hex: "7a8eaa").opacity(0.08)

    // Semantic Colors
    static let success = Color(hex: "6b9a78")
    static let warning = Color(hex: "b8956a")
    static let error   = Color(hex: "b87470")
    static let info    = Color(hex: "06B6D4")

    // Borders
    static let border        = Color(hex: "1f1f1f")   // light divider
    static let borderStrong  = Color(hex: "262626")   // stronger card stroke
    static let borderAccent  = Color(hex: "7a8eaa").opacity(0.25)
    
    // Spacing
    static let spacingXs: CGFloat = 4
    static let spacingSm: CGFloat = 8
    static let spacingMd: CGFloat = 16
    static let spacingLg: CGFloat = 24
}

extension Color {
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3: // RGB (12-bit)
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6: // RGB (24-bit)
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8: // ARGB (32-bit)
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (255, 0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
