import Foundation
import Observation

struct RecentRoomSummary: Identifiable, Hashable {
    let roomCode: String
    let hostUsername: String
    let lastTrackTitle: String?
    let lastJoinedAt: Date

    var id: String { roomCode }
}

@MainActor
@Observable
final class HomeViewModel {
    var joinCode = ""
    private(set) var isCreating = false
    private(set) var joiningCode: String?
    private(set) var recent: [RecentRoomSummary] = []
    var error: PresentableError?

    var joinCodeValidation: String? {
        joinCode.isEmpty ? nil : RoomCode.validationMessage(for: joinCode)
    }

    var canJoin: Bool {
        joiningCode == nil && !joinCode.isEmpty && joinCodeValidation == nil
    }

    var isBusy: Bool { isCreating || joiningCode != nil }

    func loadRecent(from store: RecentRoomsStore, userId: String) {
        recent = store.recent(for: userId).map {
            RecentRoomSummary(roomCode: $0.roomCode, hostUsername: $0.hostUsername, lastTrackTitle: $0.lastTrackTitle, lastJoinedAt: $0.lastJoinedAt)
        }
    }

    /// - Returns: `true` when a room session is now active.
    func createRoom(rooms: RoomsController, user: PublicUser) async -> Bool {
        guard !isBusy else { return false }
        isCreating = true
        error = nil
        defer { isCreating = false }
        do {
            _ = try await rooms.createRoom(as: user)
            return true
        } catch {
            self.error = PresentableError(error)
            return false
        }
    }

    func join(code: String, rooms: RoomsController, user: PublicUser) async -> Bool {
        guard !isBusy, RoomCode.validationMessage(for: code) == nil else { return false }
        let normalized = RoomCode.normalize(code)
        joiningCode = normalized
        error = nil
        defer { joiningCode = nil }
        do {
            _ = try await rooms.joinRoom(code: normalized, as: user)
            joinCode = ""
            return true
        } catch {
            self.error = PresentableError(error)
            return false
        }
    }
}
