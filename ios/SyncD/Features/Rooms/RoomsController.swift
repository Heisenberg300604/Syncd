import Foundation
import Observation

/// Holds the single active `RoomSession`. Joining a different room closes the
/// previous session first, so there is never more than one socket or player.
@MainActor
@Observable
final class RoomsController {
    private(set) var active: RoomSession?

    @ObservationIgnored private let api: any SyncDAPIProtocol
    @ObservationIgnored private let playback: PlaybackCoordinator
    @ObservationIgnored private let recentRooms: RecentRoomsStore?
    @ObservationIgnored private let makeClient: @MainActor (String) -> any RoomRealtimeClient

    init(
        api: any SyncDAPIProtocol,
        playback: PlaybackCoordinator,
        recentRooms: RecentRoomsStore?,
        makeClient: @escaping @MainActor (String) -> any RoomRealtimeClient
    ) {
        self.api = api
        self.playback = playback
        self.recentRooms = recentRooms
        self.makeClient = makeClient
    }

    func createRoom(as user: PublicUser) async throws(APIError) -> RoomSession {
        let room = try await api.createRoom()
        return open(room, as: user)
    }

    /// REST join (creates membership if needed), then opens the realtime session.
    func joinRoom(code: String, as user: PublicUser) async throws(APIError) -> RoomSession {
        let normalized = RoomCode.normalize(code)
        if let active, active.roomCode == normalized { return active }
        let room = try await api.joinRoom(code: normalized)
        return open(room, as: user)
    }

    /// Leaves the room server-side (membership removed; host hands over).
    func leaveActiveRoom(as user: PublicUser) async throws(APIError) {
        guard let session = active else { return }
        try await api.leaveRoom(code: session.roomCode)
        closeActive()
        recentRooms?.remove(roomCode: session.roomCode, for: user.id)
    }

    /// Stops listening without leaving membership (sign-out, disconnect).
    func closeActive() {
        active?.stop()
        active = nil
    }

    private func open(_ room: Room, as user: PublicUser) -> RoomSession {
        if let active, active.roomCode == room.roomCode { return active }
        closeActive()
        let session = RoomSession(room: room, currentUserId: user.id, client: makeClient(room.roomCode), playback: playback)
        active = session
        session.start()
        recentRooms?.record(room, for: user.id)
        return session
    }
}
