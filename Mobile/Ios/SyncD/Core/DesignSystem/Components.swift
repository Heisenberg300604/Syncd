import SwiftUI

// MARK: Buttons

struct SDButtonStyle: ButtonStyle {
    enum Kind { case primary, secondary, ghost, destructive }
    var kind: Kind = .primary
    var fullWidth = true

    @Environment(\.isEnabled) private var isEnabled

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .frame(maxWidth: fullWidth ? .infinity : nil, minHeight: Theme.minTouchTarget + 6)
            .padding(.horizontal, Theme.Spacing.md)
            .foregroundStyle(foreground)
            .background(background, in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
            .overlay {
                if kind == .secondary {
                    RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous)
                        .strokeBorder(Theme.Palette.lineStrong)
                }
            }
            .shadow(color: kind == .primary && isEnabled ? Theme.Palette.accent.opacity(0.35) : .clear, radius: 16, y: 6)
            .opacity(isEnabled ? (configuration.isPressed ? 0.85 : 1) : 0.45)
            .scaleEffect(configuration.isPressed ? 0.98 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }

    private var foreground: Color {
        switch kind {
        case .primary: Theme.Palette.accentInk
        case .secondary, .ghost: Theme.Palette.ink
        case .destructive: Theme.Palette.danger
        }
    }

    private var background: Color {
        switch kind {
        case .primary: Theme.Palette.accent
        case .secondary: Theme.Palette.raised
        case .ghost: .clear
        case .destructive: Theme.Palette.danger.opacity(0.12)
        }
    }
}

/// A button that shows a spinner and blocks re-taps while `isLoading`.
struct LoadingButton: View {
    let title: String
    var systemImage: String?
    var kind: SDButtonStyle.Kind = .primary
    let isLoading: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: Theme.Spacing.xs) {
                if isLoading {
                    ProgressView().tint(kind == .primary ? Theme.Palette.accentInk : Theme.Palette.ink)
                } else if let systemImage {
                    Image(systemName: systemImage)
                }
                Text(title)
            }
        }
        .buttonStyle(SDButtonStyle(kind: kind))
        .disabled(isLoading)
        .accessibilityLabel(isLoading ? "\(title), in progress" : title)
    }
}

// MARK: Surfaces

struct CardModifier: ViewModifier {
    var padding: CGFloat = Theme.Spacing.md

    func body(content: Content) -> some View {
        content
            .padding(padding)
            .background(Theme.Palette.surface, in: RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous))
            .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous).strokeBorder(Theme.Palette.line))
    }
}

extension View {
    func sdCard(padding: CGFloat = Theme.Spacing.md) -> some View {
        modifier(CardModifier(padding: padding))
    }

    func sdScreenBackground() -> some View {
        background(Theme.Palette.canvas.ignoresSafeArea())
    }
}

struct SectionHeader: View {
    let title: String
    var trailing: String?

    var body: some View {
        HStack {
            Text(title)
                .font(.footnote.weight(.semibold))
                .textCase(.uppercase)
                .tracking(0.8)
                .foregroundStyle(Theme.Palette.inkFaint)
            Spacer()
            if let trailing {
                Text(trailing).font(.mono(.footnote)).foregroundStyle(Theme.Palette.inkFaint)
            }
        }
        .accessibilityAddTraits(.isHeader)
    }
}

// MARK: Identity

/// Deterministic warm gradient + initial; mirrors the web's CSS-only avatars.
struct AvatarView: View {
    let name: String
    var size: CGFloat = 36
    var isOnline: Bool?

    var body: some View {
        let hue = Self.hue(for: name)
        Circle()
            .fill(LinearGradient(
                colors: [Color(hue: hue, saturation: 0.65, brightness: 0.95), Color(hue: (hue + 0.06).truncatingRemainder(dividingBy: 1), saturation: 0.8, brightness: 0.7)],
                startPoint: .topLeading, endPoint: .bottomTrailing
            ))
            .frame(width: size, height: size)
            .overlay {
                Text(name.first.map { String($0).uppercased() } ?? "?")
                    .font(.system(size: size * 0.42, weight: .bold, design: .rounded))
                    .foregroundStyle(Theme.Palette.accentInk)
            }
            .overlay(alignment: .bottomTrailing) {
                if let isOnline {
                    Circle()
                        .fill(isOnline ? Theme.Palette.online : Theme.Palette.inkFaint)
                        .frame(width: size * 0.3, height: size * 0.3)
                        .overlay(Circle().strokeBorder(Theme.Palette.surface, lineWidth: 2))
                }
            }
            .accessibilityHidden(true)
    }

    /// Stable across launches (unlike `String.hashValue`), biased to warm hues.
    static func hue(for name: String) -> Double {
        var hash: UInt32 = 5381
        for scalar in name.unicodeScalars { hash = (hash &* 33) &+ scalar.value }
        let warmHues: [Double] = [0.02, 0.05, 0.08, 0.11, 0.95, 0.9, 0.55]
        return warmHues[Int(hash % UInt32(warmHues.count))]
    }
}

struct ArtworkView: View {
    let url: URL?
    var size: CGFloat
    var cornerRadius: CGFloat = Theme.Radius.md

    var body: some View {
        AsyncImage(url: url, transaction: Transaction(animation: .easeOut(duration: 0.2))) { phase in
            switch phase {
            case let .success(image):
                image.resizable().scaledToFill()
            default:
                placeholder
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous).strokeBorder(Theme.Palette.line))
        .accessibilityHidden(true)
    }

    private var placeholder: some View {
        ZStack {
            LinearGradient(colors: [Theme.Palette.overlay, Theme.Palette.raised], startPoint: .topLeading, endPoint: .bottomTrailing)
            Image(systemName: "waveform")
                .font(.system(size: size * 0.32, weight: .medium))
                .foregroundStyle(Theme.Palette.accent.opacity(0.7))
        }
    }
}

struct HostBadge: View {
    var body: some View {
        Text("HOST")
            .font(.caption2.weight(.bold))
            .tracking(0.6)
            .padding(.horizontal, 6)
            .padding(.vertical, 2)
            .foregroundStyle(Theme.Palette.accentInk)
            .background(Theme.Palette.accent, in: Capsule())
            .accessibilityLabel("Host")
    }
}

/// Small animated bars signalling live audio. Static when Reduce Motion is on.
struct EqualizerBars: View {
    var isAnimating: Bool
    var color: Color = Theme.Palette.accent

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        TimelineView(.animation(minimumInterval: 0.12, paused: !isAnimating || reduceMotion)) { context in
            let t = context.date.timeIntervalSinceReferenceDate
            HStack(alignment: .bottom, spacing: 2) {
                ForEach(0..<3, id: \.self) { index in
                    Capsule()
                        .fill(color)
                        .frame(width: 3, height: height(index: index, time: t))
                }
            }
            .frame(height: 14, alignment: .bottom)
        }
        .accessibilityHidden(true)
    }

    private func height(index: Int, time: TimeInterval) -> CGFloat {
        guard isAnimating, !reduceMotion else { return [6, 10, 7][index] }
        let phase = time * 6 + Double(index) * 1.7
        return 4 + CGFloat((sin(phase) + 1) / 2) * 10
    }
}
