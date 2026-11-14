import SwiftUI
import UIKit

/// Design tokens mirroring `client/src/index.css` `@theme` so iOS and web share
/// one warm amber/sunset identity. Dark-first; light values keep the app
/// usable when the system is in light mode.
enum Theme {
    enum Palette {
        static let canvas = Color(light: 0xFAF7F2, dark: 0x0A0908)
        static let surface = Color(light: 0xFFFFFF, dark: 0x12100E)
        static let raised = Color(light: 0xF3EEE7, dark: 0x181512)
        static let overlay = Color(light: 0xEBE4DA, dark: 0x201B16)

        static let line = Color(lightRGBA: (0, 0, 0, 0.08), darkRGBA: (1, 1, 1, 0.08))
        static let lineStrong = Color(lightRGBA: (0, 0, 0, 0.16), darkRGBA: (1, 1, 1, 0.16))

        static let ink = Color(light: 0x1A1612, dark: 0xF5F3F0)
        static let inkMuted = Color(light: 0x5E554B, dark: 0xB0A79C)
        static let inkFaint = Color(light: 0x8A7F73, dark: 0x7C7167)

        static let accent = Color(hex: 0xF7A23B)
        static let accentHi = Color(hex: 0xF97316)
        static let accentLo = Color(hex: 0xF7A23B).opacity(0.12)
        static let accentInk = Color(hex: 0x1A1206)
        /// Accent used for text on the current background (amber is too light on white).
        static let accentText = Color(light: 0xC2410C, dark: 0xF7A23B)

        static let online = Color(hex: 0x34D399)
        static let warning = Color(hex: 0xFBBF24)
        static let danger = Color(light: 0xDC2626, dark: 0xF87171)
    }

    enum Radius {
        static let sm: CGFloat = 8
        static let md: CGFloat = 12
        static let lg: CGFloat = 16
        static let xl: CGFloat = 22
    }

    enum Spacing {
        static let xxs: CGFloat = 4
        static let xs: CGFloat = 8
        static let sm: CGFloat = 12
        static let md: CGFloat = 16
        static let lg: CGFloat = 24
        static let xl: CGFloat = 32
    }

    /// Minimum hit target (Apple HIG).
    static let minTouchTarget: CGFloat = 44
}

extension Color {
    init(hex: UInt32, opacity: Double = 1) {
        self.init(
            .sRGB,
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255,
            opacity: opacity
        )
    }

    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { traits in
            UIColor(rgb: traits.userInterfaceStyle == .light ? light : dark)
        })
    }

    init(lightRGBA: (CGFloat, CGFloat, CGFloat, CGFloat), darkRGBA: (CGFloat, CGFloat, CGFloat, CGFloat)) {
        self.init(uiColor: UIColor { traits in
            let c = traits.userInterfaceStyle == .light ? lightRGBA : darkRGBA
            return UIColor(red: c.0, green: c.1, blue: c.2, alpha: c.3)
        })
    }
}

private extension UIColor {
    convenience init(rgb: UInt32) {
        self.init(
            red: CGFloat((rgb >> 16) & 0xFF) / 255,
            green: CGFloat((rgb >> 8) & 0xFF) / 255,
            blue: CGFloat(rgb & 0xFF) / 255,
            alpha: 1
        )
    }
}

extension Font {
    /// Room codes, durations and timestamps — mirrors the web's `font-mono`.
    static func mono(_ style: Font.TextStyle, weight: Font.Weight = .medium) -> Font {
        .system(style, design: .monospaced, weight: weight)
    }
}
