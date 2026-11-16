import Foundation
import SwiftData

/// A room this device has joined. A local convenience cache only — the server
/// is authoritative for membership and has no "recent rooms" endpoint
/// (Documentation/BACKEND_CONTRACT.md §4.3). Scoped per SyncD user so two
/// accounts on one device don't see each other's rooms.
@Model
final class RecentRoom {
    /// `"<userId>:<roomCode>"`
    @Attribute(.unique) var key: String
    var ownerUserId: String
    var roomCode: String
    var hostUsername: String
    var lastTrackTitle: String?
    var lastJoinedAt: Date

    init(ownerUserId: String, roomCode: String, hostUsername: String, lastTrackTitle: String?, lastJoinedAt: Date) {
        self.key = "\(ownerUserId):\(roomCode)"
        self.ownerUserId = ownerUserId
        self.roomCode = roomCode
        self.hostUsername = hostUsername
        self.lastTrackTitle = lastTrackTitle
        self.lastJoinedAt = lastJoinedAt
    }
}

@MainActor
final class RecentRoomsStore {
    private let context: ModelContext

    init(container: ModelContainer) {
        context = ModelContext(container)
    }

    func record(_ room: Room, for userId: String) {
        let key = "\(userId):\(room.roomCode)"
        let descriptor = FetchDescriptor<RecentRoom>(predicate: #Predicate { $0.key == key })
        if let existing = try? context.fetch(descriptor).first {
            existing.hostUsername = room.host.username
            existing.lastTrackTitle = room.currentTitle
            existing.lastJoinedAt = .now
        } else {
            context.insert(RecentRoom(
                ownerUserId: userId,
                roomCode: room.roomCode,
                hostUsername: room.host.username,
                lastTrackTitle: room.currentTitle,
                lastJoinedAt: .now
            ))
        }
        save()
    }

    func recent(for userId: String, limit: Int = 10) -> [RecentRoom] {
        var descriptor = FetchDescriptor<RecentRoom>(
            predicate: #Predicate { $0.ownerUserId == userId },
            sortBy: [SortDescriptor(\.lastJoinedAt, order: .reverse)]
        )
        descriptor.fetchLimit = limit
        do {
            return try context.fetch(descriptor)
        } catch {
            Log.app.error("Fetching recent rooms failed: \(String(describing: error), privacy: .private)")
            return []
        }
    }

    func remove(roomCode: String, for userId: String) {
        let key = "\(userId):\(roomCode)"
        try? context.delete(model: RecentRoom.self, where: #Predicate { $0.key == key })
        save()
    }

    func removeAll() {
        try? context.delete(model: RecentRoom.self)
        save()
    }

    private func save() {
        do { try context.save() } catch {
            Log.app.error("Saving recent rooms failed: \(String(describing: error), privacy: .private)")
        }
    }
}
