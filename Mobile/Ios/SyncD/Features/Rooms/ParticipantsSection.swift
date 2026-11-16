import SwiftUI

struct ParticipantsSection: View {
    let session: RoomSession
    let onError: (PresentableError) -> Void
    @State private var transferringTo: String?

    var body: some View {
        Section {
            ForEach(session.members) { member in
                HStack(spacing: Theme.Spacing.sm) {
                    AvatarView(name: member.username, size: 34, isOnline: session.hasJoined ? member.online : nil)
                    Text(member.userId == session.currentUserId ? "\(member.username) (you)" : member.username)
                        .foregroundStyle(member.online || !session.hasJoined ? Theme.Palette.ink : Theme.Palette.inkFaint)
                    if member.userId == session.hostUserId { HostBadge() }
                    Spacer()
                    if transferringTo == member.userId { ProgressView() }
                }
                .frame(minHeight: Theme.minTouchTarget)
                .accessibilityElement(children: .combine)
                .accessibilityValue(session.hasJoined ? (member.online ? "Online" : "Offline") : "")
                .contextMenu {
                    if canTransfer(to: member) {
                        Button { transfer(to: member) } label: { Label("Make host", systemImage: "crown") }
                    }
                }
                .swipeActions {
                    if canTransfer(to: member) {
                        Button("Make host") { transfer(to: member) }.tint(Theme.Palette.accentHi)
                    }
                }
            }
        } header: {
            SectionHeader(title: "People", trailing: "\(session.onlineCount)/\(session.members.count)")
        }
        .listRowBackground(Theme.Palette.surface)
    }

    /// Mirrors the web rule: the host can hand over to an online member.
    /// The server re-verifies host status and membership.
    private func canTransfer(to member: PresenceMember) -> Bool {
        session.isHost && member.online && member.userId != session.currentUserId && transferringTo == nil
    }

    private func transfer(to member: PresenceMember) {
        transferringTo = member.userId
        Task {
            do {
                try await session.transferHost(to: member.userId)
            } catch {
                onError(PresentableError(error))
            }
            transferringTo = nil
        }
    }
}
