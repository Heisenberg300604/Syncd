import SwiftUI

struct RoomView: View {
    let session: RoomSession
    let user: PublicUser

    @Environment(RoomsController.self) private var rooms
    @Environment(PlaybackCoordinator.self) private var playback
    @State private var isSearchPresented = false
    @State private var isLeaveConfirmationPresented = false
    @State private var isLeaving = false
    @State private var actionError: PresentableError?

    var body: some View {
        List {
            Section {
                RoomHeaderView(session: session)
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }

            if let pending = session.hostPending {
                Section { HostPendingBanner(pending: pending) }
                    .listRowBackground(Theme.Palette.warning.opacity(0.12))
            }
            if let notice = session.hostNotice {
                Section { HostNoticeBanner(notice: notice, currentUserId: user.id, dismiss: session.dismissHostNotice) }
                    .listRowBackground(Theme.Palette.accentLo)
            }
            if let error = actionError ?? playback.commandError {
                Section {
                    InlineErrorBanner(error: error, onDismiss: {
                        actionError = nil
                        playback.commandError = nil
                    })
                }
                .listRowInsets(EdgeInsets())
                .listRowBackground(Color.clear)
            }

            Section {
                NowPlayingCard(session: session, openSearch: { isSearchPresented = true })
            } header: {
                SectionHeader(title: "Now playing")
            }
            .listRowBackground(Theme.Palette.surface)

            Section {
                NavigationLink {
                    ChatView(session: session, user: user)
                } label: {
                    ChatPreviewRow(messages: session.messages)
                }
            } header: {
                SectionHeader(title: "Chat")
            }
            .listRowBackground(Theme.Palette.surface)

            QueueSection(session: session, onError: { actionError = $0 }, openSearch: { isSearchPresented = true })

            ParticipantsSection(session: session, onError: { actionError = $0 })
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .sdScreenBackground()
        .navigationTitle(session.roomCode)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Menu {
                    ShareLink(item: session.roomCode, message: Text("Join my SyncD room: \(session.roomCode)")) {
                        Label("Share room code", systemImage: "square.and.arrow.up")
                    }
                    if session.isHost {
                        Button { isSearchPresented = true } label: { Label("Add music", systemImage: "plus") }
                    }
                    Divider()
                    Button { rooms.closeActive() } label: {
                        Label("Stop listening", systemImage: "headphones.slash")
                    }
                    Button(role: .destructive) { isLeaveConfirmationPresented = true } label: {
                        Label("Leave room", systemImage: "rectangle.portrait.and.arrow.right")
                    }
                } label: {
                    if isLeaving { ProgressView() } else { Image(systemName: "ellipsis.circle") }
                }
                .accessibilityLabel("Room options")
            }
        }
        .confirmationDialog("Leave this room?", isPresented: $isLeaveConfirmationPresented, titleVisibility: .visible) {
            Button("Leave room", role: .destructive, action: leave)
        } message: {
            Text(session.isHost
                 ? "You're the host. Hosting passes to the longest-standing member, or the room is deleted if you're the last one."
                 : "You'll need the code to rejoin.")
        }
        .sheet(isPresented: $isSearchPresented) {
            NavigationStack { SearchView(session: session) }
        }
    }

    private func leave() {
        isLeaving = true
        Task {
            do {
                try await rooms.leaveActiveRoom(as: user)
            } catch {
                actionError = PresentableError(error)
            }
            isLeaving = false
        }
    }
}

private struct RoomHeaderView: View {
    let session: RoomSession
    @State private var didCopy = false

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("ROOM CODE").font(.caption2.weight(.semibold)).tracking(0.8).foregroundStyle(Theme.Palette.inkFaint)
                    Text(session.roomCode)
                        .font(.mono(.largeTitle, weight: .bold))
                        .foregroundStyle(Theme.Palette.ink)
                        .accessibilityLabel("Room code \(session.roomCode.map(String.init).joined(separator: " "))")
                }
                Spacer()
                Button {
                    UIPasteboard.general.string = session.roomCode
                    didCopy = true
                    Task {
                        try? await Task.sleep(for: .seconds(1.5))
                        didCopy = false
                    }
                } label: {
                    Label(didCopy ? "Copied" : "Copy", systemImage: didCopy ? "checkmark" : "doc.on.doc")
                        .font(.footnote.weight(.semibold))
                }
                .buttonStyle(SDButtonStyle(kind: .secondary, fullWidth: false))
            }
            HStack(spacing: Theme.Spacing.xs) {
                ConnectionStatusPill(state: session.connection)
                Text("Hosted by \(session.isHost ? "you" : session.hostUsername) · \(session.onlineCount) online")
                    .font(.footnote)
                    .foregroundStyle(Theme.Palette.inkMuted)
            }
            if let reason = session.connection.failureReason {
                Label(reason, systemImage: "exclamationmark.triangle")
                    .font(.footnote)
                    .foregroundStyle(Theme.Palette.danger)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(.vertical, Theme.Spacing.xs)
    }
}

private struct NowPlayingCard: View {
    let session: RoomSession
    let openSearch: () -> Void
    @Environment(PlaybackCoordinator.self) private var playback

    var body: some View {
        if playback.item != nil {
            VStack(spacing: Theme.Spacing.md) {
                if playback.audioAvailability == .embedded {
                    YouTubePlayerSurface()
                }
                HStack(spacing: Theme.Spacing.md) {
                    ArtworkView(url: playback.item?.artworkURL, size: 76)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(playback.item?.title ?? "")
                            .font(.headline)
                            .lineLimit(2)
                            .foregroundStyle(Theme.Palette.ink)
                        HStack(spacing: 6) {
                            EqualizerBars(isAnimating: playback.isRoomPlaying)
                            PlaybackStatusLabel()
                        }
                    }
                    Spacer(minLength: 0)
                }
                PlaybackProgressView()
                HStack(spacing: Theme.Spacing.lg) {
                    PlayPauseButton(size: 52, prominent: true)
                    if session.isHost { SkipButton(size: 44) }
                    Spacer()
                }
                AudioAvailabilityNote()
            }
            .padding(.vertical, Theme.Spacing.xs)
        } else if !session.hasJoined, let reason = session.connection.failureReason {
            // Don't spin forever: say why the room can't be reached yet.
            VStack(spacing: Theme.Spacing.xs) {
                Image(systemName: "wifi.exclamationmark")
                    .font(.title2)
                    .foregroundStyle(Theme.Palette.warning)
                    .accessibilityHidden(true)
                Text("Can't connect to the room").font(.headline)
                Text(reason)
                    .font(.footnote)
                    .multilineTextAlignment(.center)
                    .foregroundStyle(Theme.Palette.inkMuted)
                if case .reconnecting = session.connection {
                    Text("Retrying automatically.").font(.caption).foregroundStyle(Theme.Palette.inkFaint)
                }
            }
            .frame(maxWidth: .infinity, minHeight: 80)
            .padding(.vertical, Theme.Spacing.xs)
        } else if !session.hasJoined {
            HStack {
                ProgressView()
                Text("Syncing with the room…").foregroundStyle(Theme.Palette.inkMuted)
            }
            .frame(maxWidth: .infinity, minHeight: 80)
        } else {
            EmptyStateView(
                systemImage: "music.note",
                title: "Nothing playing",
                message: session.isHost ? "Search for a track or paste a YouTube link to start the room." : "Waiting for the host to pick something.",
                actionTitle: session.isHost ? "Add music" : nil,
                action: session.isHost ? openSearch : nil
            )
        }
    }
}

private struct ChatPreviewRow: View {
    let messages: [ChatMessage]

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: "bubble.left.and.bubble.right.fill")
                .foregroundStyle(Theme.Palette.accent)
                .frame(width: 32)
                .accessibilityHidden(true)
            if let last = messages.last {
                VStack(alignment: .leading, spacing: 2) {
                    Text(last.username).font(.subheadline.weight(.semibold))
                    Text(last.content).font(.footnote).lineLimit(1).foregroundStyle(Theme.Palette.inkMuted)
                }
            } else {
                Text("Say hello to the room").foregroundStyle(Theme.Palette.inkMuted)
            }
        }
        .padding(.vertical, 4)
        .accessibilityElement(children: .combine)
        .accessibilityHint("Opens chat")
    }
}

private struct HostPendingBanner: View {
    let pending: HostPending

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: "hourglass").foregroundStyle(Theme.Palette.warning)
            VStack(alignment: .leading, spacing: 2) {
                Text("\(pending.hostUsername) disconnected").font(.subheadline.weight(.semibold))
                if let deadline = pending.deadline, let successor = pending.successorUsername {
                    HStack(spacing: 4) {
                        Text("\(successor) becomes host in")
                        Text(timerInterval: Date.now...max(deadline, .now), countsDown: true)
                            .monospacedDigit()
                    }
                    .font(.footnote)
                    .foregroundStyle(Theme.Palette.inkMuted)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct HostNoticeBanner: View {
    let notice: HostUpdate
    let currentUserId: String
    let dismiss: () -> Void

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            Image(systemName: "crown.fill").foregroundStyle(Theme.Palette.accent)
            Text(text).font(.subheadline)
            Spacer()
            Button(action: dismiss) { Image(systemName: "xmark").font(.footnote.weight(.semibold)) }
                .buttonStyle(.plain)
                .frame(width: Theme.minTouchTarget, height: Theme.minTouchTarget)
                .accessibilityLabel("Dismiss")
        }
    }

    private var text: String {
        let newHost = notice.hostUserId == currentUserId ? "You are" : "\(notice.hostUsername) is"
        switch notice.reason {
        case .manual: return "\(newHost) now the host."
        case .disconnect: return "\(newHost) now the host — \(notice.previousHostUsername) disconnected."
        case .left: return "\(newHost) now the host — \(notice.previousHostUsername) left."
        }
    }
}
