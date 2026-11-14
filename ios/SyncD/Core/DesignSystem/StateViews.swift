import SwiftUI

/// Shared loading / empty / error treatments so every screen handles the
/// same states the same way.

struct LoadingStateView: View {
    var message: String = "Loading…"

    var body: some View {
        VStack(spacing: Theme.Spacing.sm) {
            ProgressView().controlSize(.large).tint(Theme.Palette.accent)
            Text(message).font(.subheadline).foregroundStyle(Theme.Palette.inkMuted)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityElement(children: .combine)
    }
}

struct EmptyStateView: View {
    let systemImage: String
    let title: String
    let message: String
    var actionTitle: String?
    var action: (() -> Void)?

    var body: some View {
        VStack(spacing: Theme.Spacing.sm) {
            Image(systemName: systemImage)
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(Theme.Palette.accent.opacity(0.8))
                .accessibilityHidden(true)
            Text(title).font(.headline).foregroundStyle(Theme.Palette.ink)
            Text(message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Palette.inkMuted)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(SDButtonStyle(kind: .secondary, fullWidth: false))
                    .padding(.top, Theme.Spacing.xs)
            }
        }
        .padding(Theme.Spacing.lg)
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .contain)
    }
}

struct ErrorStateView: View {
    let error: any UserFacingError
    var retry: (() -> Void)?

    var body: some View {
        VStack(spacing: Theme.Spacing.sm) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 30, weight: .regular))
                .foregroundStyle(Theme.Palette.warning)
                .accessibilityHidden(true)
            Text(error.title).font(.headline).foregroundStyle(Theme.Palette.ink)
            Text(error.message)
                .font(.subheadline)
                .multilineTextAlignment(.center)
                .foregroundStyle(Theme.Palette.inkMuted)
            if error.isRetryable, let retry {
                Button("Try again", action: retry)
                    .buttonStyle(SDButtonStyle(kind: .secondary, fullWidth: false))
                    .padding(.top, Theme.Spacing.xs)
            }
        }
        .padding(Theme.Spacing.lg)
        .frame(maxWidth: .infinity)
    }
}

/// An inline, dismissible error row for failed actions (send, queue, controls).
struct InlineErrorBanner: View {
    let error: PresentableError
    var onDismiss: () -> Void
    var onRetry: (() -> Void)?

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.xs) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(Theme.Palette.danger)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(error.title).font(.subheadline.weight(.semibold))
                Text(error.message).font(.footnote).foregroundStyle(Theme.Palette.inkMuted)
            }
            Spacer(minLength: 0)
            if error.isRetryable, let onRetry {
                Button("Retry", action: onRetry).font(.footnote.weight(.semibold))
            }
            Button(action: onDismiss) {
                Image(systemName: "xmark").font(.footnote.weight(.semibold))
                    .frame(width: 28, height: 28)
            }
            .accessibilityLabel("Dismiss")
        }
        .foregroundStyle(Theme.Palette.ink)
        .padding(Theme.Spacing.sm)
        .background(Theme.Palette.danger.opacity(0.1), in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
        .accessibilityElement(children: .contain)
    }
}

struct ConnectionStatusPill: View {
    let state: RoomConnectionState

    var body: some View {
        HStack(spacing: 6) {
            Circle().fill(color).frame(width: 7, height: 7)
            Text(label).font(.caption.weight(.semibold))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 5)
        .foregroundStyle(Theme.Palette.inkMuted)
        .background(Theme.Palette.raised, in: Capsule())
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Connection: \(label)")
    }

    private var label: String {
        switch state {
        case .idle: "Offline"
        case .connecting: "Connecting"
        case .connected: "Live"
        case let .reconnecting(attempt, _): attempt > 1 ? "Reconnecting (\(attempt))" : "Reconnecting"
        case .failed: "Disconnected"
        }
    }

    private var color: Color {
        switch state {
        case .connected: Theme.Palette.online
        case .connecting, .reconnecting: Theme.Palette.warning
        case .idle, .failed: Theme.Palette.danger
        }
    }
}
