import Foundation
import Observation

/// App-level authentication state.
///
/// Mirrors the web `CurrentUserProvider` rules:
/// - `/me` is fetched once per signed-in session, not on every screen.
/// - A failed `/me` never routes to onboarding — only a successful response
///   with `onboardingComplete: false` does. Failures show a retryable error.
/// - Completing onboarding seeds the cache from the profile response.
@MainActor
@Observable
final class SessionStore {
    enum State: Equatable {
        case launching
        case signedOut
        case loadingProfile
        case onboarding
        case ready(PublicUser)
        case failed
    }

    private(set) var state: State = .launching
    private(set) var error: PresentableError?

    var currentUser: PublicUser? {
        if case let .ready(user) = state { return user }
        return nil
    }

    @ObservationIgnored private let auth: any AuthProviding
    @ObservationIgnored private let api: any SyncDAPIProtocol
    @ObservationIgnored private var refreshTask: Task<Void, Never>?
    /// Tears down room/playback state. Set by `AppDependencies`.
    @ObservationIgnored var onSignedOut: (@MainActor () async -> Void)?

    init(auth: any AuthProviding, api: any SyncDAPIProtocol) {
        self.auth = auth
        self.api = api
    }

    func start() {
        auth.observeChanges { [weak self] in self?.refresh() }
        refresh()
    }

    /// Re-derives state from the auth provider. Safe to call repeatedly.
    func refresh() {
        guard auth.isLoaded else {
            state = .launching
            return
        }
        guard auth.hasActiveSession, let clerkUserId = auth.clerkUserId else {
            transitionToSignedOut()
            return
        }
        // Session cache: the same account does not refetch `/me`.
        if let user = currentUser, user.clerkUserId == clerkUserId { return }
        if state == .loadingProfile || state == .onboarding { return }
        loadProfile()
    }

    func retry() {
        guard auth.hasActiveSession else { return transitionToSignedOut() }
        loadProfile()
    }

    private func loadProfile() {
        refreshTask?.cancel()
        state = .loadingProfile
        error = nil
        refreshTask = Task { [weak self, api] in
            do {
                let me = try await api.me()
                guard let self, !Task.isCancelled else { return }
                if me.onboardingComplete, let user = me.user {
                    self.state = .ready(user)
                } else {
                    self.state = .onboarding
                }
            } catch {
                let error = APIClient.map(transportError: error)
                guard error != .cancelled, let self, !Task.isCancelled else { return }
                Log.auth.error("Loading profile failed: \(error.title, privacy: .public)")
                if error == .unauthorized || error == .notSignedIn {
                    self.transitionToSignedOut()
                } else {
                    self.error = PresentableError(error)
                    self.state = .failed
                }
            }
        }
    }

    /// Creates the SyncD profile. Throws so the onboarding form can show
    /// field-level errors (e.g. 409 username taken).
    func completeOnboarding(username: String) async throws(APIError) {
        let user = try await api.createProfile(username: username.trimmingCharacters(in: .whitespacesAndNewlines))
        state = .ready(user)
    }

    func signOut() async {
        refreshTask?.cancel()
        await onSignedOut?()
        // Leave `.ready` before Clerk's change notification arrives so the
        // teardown hook does not run twice.
        state = .signedOut
        do {
            try await auth.signOut()
        } catch {
            // Local teardown already happened; Clerk will also drop the
            // session when the server-side revoke eventually succeeds.
            Log.auth.error("Sign-out request failed: \(String(describing: type(of: error)), privacy: .public)")
        }
        transitionToSignedOut()
    }

    private func transitionToSignedOut() {
        refreshTask?.cancel()
        let wasSignedIn = currentUser != nil
        state = .signedOut
        error = nil
        if wasSignedIn {
            Task { await onSignedOut?() }
        }
    }
}
