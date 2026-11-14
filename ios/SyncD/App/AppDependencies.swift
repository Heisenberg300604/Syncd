import ClerkKit
import Foundation
import Observation
import SwiftData

/// Composition root. Every long-lived service is created exactly once here
/// and injected through the SwiftUI environment — no singletons beyond the
/// ones Apple and Clerk own.
@MainActor
@Observable
final class AppDependencies {
    let configuration: AppConfiguration
    let clerk: Clerk
    let session: SessionStore
    let playback: PlaybackCoordinator
    /// YouTube's official embedded player; rendered by `YouTubePlayerSurface`.
    let youTubePlayer: YouTubeEmbedEngine
    let rooms: RoomsController
    let recentRooms: RecentRoomsStore
    let api: any SyncDAPIProtocol
    let modelContainer: ModelContainer

    init(configuration: AppConfiguration, clerk: Clerk) {
        self.configuration = configuration
        self.clerk = clerk

        let auth = ClerkAuthProvider(clerk: clerk)
        let tokenProvider: AuthTokenProvider = { [auth] forceRefresh in
            try await auth.token(forceRefresh: forceRefresh)
        }
        let api = SyncDAPI(client: APIClient(baseURL: configuration.apiBaseURL, tokenProvider: tokenProvider))
        self.api = api

        modelContainer = Self.makeModelContainer()
        recentRooms = RecentRoomsStore(container: modelContainer)

        let clock = SystemMonotonicClock()
        let youTubePlayer = YouTubeEmbedEngine()
        self.youTubePlayer = youTubePlayer
        playback = PlaybackCoordinator(
            engine: AVPlayerAudioEngine(),
            embedEngine: youTubePlayer,
            audioSession: AudioSessionManager(),
            nowPlaying: NowPlayingManager(),
            remoteCommands: RemoteCommandManager(),
            clock: clock
        )

        let socketURL = configuration.socketURL
        rooms = RoomsController(api: api, playback: playback, recentRooms: recentRooms) { roomCode in
            SocketIORoomClient(roomCode: roomCode, socketURL: socketURL, clock: clock, tokenProvider: tokenProvider)
        }

        session = SessionStore(auth: auth, api: api)
        session.onSignedOut = { [rooms, playback, recentRooms] in
            rooms.closeActive()
            playback.stopLocal()
            recentRooms.removeAll()
        }
    }

    func start() {
        session.start()
    }

    private static func makeModelContainer() -> ModelContainer {
        do {
            return try ModelContainer(for: RecentRoom.self)
        } catch {
            // The cache is a convenience; fall back to memory rather than crash.
            Log.app.error("Persistent store unavailable, using in-memory store: \(String(describing: error), privacy: .private)")
            do {
                return try ModelContainer(for: RecentRoom.self, configurations: ModelConfiguration(isStoredInMemoryOnly: true))
            } catch {
                fatalError("Unable to create even an in-memory SwiftData container: \(error)")
            }
        }
    }
}
