import ClerkKit
import ClerkKitUI
import SwiftUI

/// Signed-out landing. Authentication itself is Clerk's prebuilt `AuthView`,
/// so iOS uses the exact same Clerk instance and providers as the web app.
struct SignInView: View {
    @Environment(Clerk.self) private var clerk
    @State private var isAuthPresented = false

    var body: some View {
        VStack(spacing: Theme.Spacing.lg) {
            Spacer()
            BrandMark(size: 72)
            VStack(spacing: Theme.Spacing.xs) {
                Text("SyncD")
                    .font(.system(.largeTitle, design: .rounded, weight: .bold))
                    .foregroundStyle(Theme.Palette.ink)
                Text("Create a room, invite your people, press play.")
                    .font(.title3)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.Palette.inkMuted)
            }
            Spacer()
            VStack(spacing: Theme.Spacing.sm) {
                Button("Get started") { isAuthPresented = true }
                    .buttonStyle(SDButtonStyle(kind: .primary))
                Text("Sign in or create an account with the same login you use on the web.")
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.Palette.inkFaint)
            }
        }
        .padding(Theme.Spacing.lg)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background {
            ZStack {
                Theme.Palette.canvas
                RadialGradient(colors: [Theme.Palette.accent.opacity(0.22), .clear], center: .top, startRadius: 0, endRadius: 420)
            }
            .ignoresSafeArea()
        }
        .sheet(isPresented: $isAuthPresented) {
            AuthView()
                .environment(clerk)
        }
        .task {
            // Recovered OAuth / multi-step flows need the sheet again.
            for await event in clerk.auth.events {
                switch event {
                case .signInNeedsContinuation, .signUpNeedsContinuation:
                    isAuthPresented = true
                default:
                    break
                }
            }
        }
        .onChange(of: clerk.session?.tasks?.isEmpty == false, initial: true) { _, hasPendingTasks in
            // A pending session (e.g. required profile step) finishes in AuthView.
            if hasPendingTasks { isAuthPresented = true }
        }
    }
}
