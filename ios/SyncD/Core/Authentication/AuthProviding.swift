import ClerkKit
import Foundation

/// The identity provider as the rest of the app sees it. Only
/// `ClerkAuthProvider` imports ClerkKit; everything else depends on this
/// protocol, so the session logic is testable without a Clerk instance.
@MainActor
protocol AuthProviding: AnyObject {
    /// `false` until the SDK has restored any persisted session.
    var isLoaded: Bool { get }
    /// An active (not pending) session exists.
    var hasActiveSession: Bool { get }
    /// The Clerk user id of the active session, used to detect account switches.
    var clerkUserId: String? { get }

    func token(forceRefresh: Bool) async throws -> String?
    func signOut() async throws
    /// Invokes `handler` whenever load state or the current session changes.
    func observeChanges(_ handler: @escaping @MainActor () -> Void)
}

/// Clerk-backed implementation. Clerk persists its client and session in the
/// Keychain itself (`ClerkKit/Storage/Keychain`), so SyncD never stores
/// session tokens on its own.
@MainActor
final class ClerkAuthProvider: AuthProviding {
    let clerk: Clerk
    private var handler: (@MainActor () -> Void)?

    init(clerk: Clerk) {
        self.clerk = clerk
    }

    var isLoaded: Bool { clerk.isLoaded }

    var hasActiveSession: Bool {
        guard let session = clerk.session else { return false }
        return session.status == .active
    }

    var clerkUserId: String? { clerk.user?.id }

    func token(forceRefresh: Bool) async throws -> String? {
        try await clerk.auth.getToken(.init(skipCache: forceRefresh))
    }

    func signOut() async throws {
        try await clerk.auth.signOut()
    }

    func observeChanges(_ handler: @escaping @MainActor () -> Void) {
        self.handler = handler
        track()
    }

    /// Re-arms Observation tracking after every change; `withObservationTracking`
    /// fires once per registration.
    private func track() {
        withObservationTracking {
            _ = clerk.isLoaded
            _ = clerk.session?.id
            _ = clerk.session?.status
        } onChange: { [weak self] in
            Task { @MainActor [weak self] in
                guard let self else { return }
                self.handler?()
                self.track()
            }
        }
    }
}
