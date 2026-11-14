import ClerkKit
import SwiftUI

/// Top-level coordinator: routes on authentication state and forwards
/// app-lifecycle events to the playback and realtime layers.
struct RootView: View {
    @Environment(SessionStore.self) private var session
    @Environment(RoomsController.self) private var rooms
    @Environment(Clerk.self) private var clerk
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        Group {
            switch session.state {
            case .launching, .loadingProfile:
                LaunchView()
            case .signedOut:
                SignInView()
            case .onboarding:
                OnboardingView()
            case let .ready(user):
                MainTabView(user: user)
            case .failed:
                ProfileLoadErrorView()
            }
        }
        .animation(.easeInOut(duration: 0.25), value: session.state)
        .tint(Theme.Palette.accent)
        .preferredColorScheme(nil)
        .onOpenURL { url in
            // OAuth / magic-link callbacks for Clerk.
            Task {
                do { try await clerk.handle(url) } catch {
                    Log.auth.error("Clerk could not handle callback URL")
                }
            }
        }
        .onChange(of: scenePhase) { _, phase in
            // Sockets are suspended in the background; audio is not. On return,
            // reconnect immediately and re-align playback with the room.
            if phase == .active {
                rooms.active?.reconnectIfNeeded()
            }
        }
    }
}

struct LaunchView: View {
    var body: some View {
        VStack(spacing: Theme.Spacing.md) {
            BrandMark(size: 56)
            ProgressView().tint(Theme.Palette.accent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .sdScreenBackground()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("Loading SyncD")
    }
}

struct BrandMark: View {
    var size: CGFloat = 44

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.28, style: .continuous)
            .fill(LinearGradient(colors: [Theme.Palette.accent, Theme.Palette.accentHi], startPoint: .topLeading, endPoint: .bottomTrailing))
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: "waveform")
                    .font(.system(size: size * 0.46, weight: .bold))
                    .foregroundStyle(Theme.Palette.accentInk)
            }
            .shadow(color: Theme.Palette.accent.opacity(0.4), radius: size * 0.4, y: size * 0.12)
            .accessibilityHidden(true)
    }
}

struct ConfigurationErrorView: View {
    let error: ConfigurationError

    var body: some View {
        VStack(spacing: Theme.Spacing.md) {
            BrandMark()
            ErrorStateView(error: error)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .sdScreenBackground()
    }
}

struct ProfileLoadErrorView: View {
    @Environment(SessionStore.self) private var session

    var body: some View {
        VStack(spacing: Theme.Spacing.md) {
            BrandMark()
            ErrorStateView(error: session.error ?? PresentableError(APIError.invalidResponse)) {
                session.retry()
            }
            Button("Sign out") {
                Task { await session.signOut() }
            }
            .buttonStyle(SDButtonStyle(kind: .ghost, fullWidth: false))
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .sdScreenBackground()
    }
}
