import SwiftUI

struct HomeView: View {
    let user: PublicUser
    let showRoom: () -> Void

    @Environment(AppDependencies.self) private var dependencies
    @Environment(RoomsController.self) private var rooms
    @Environment(PlaybackCoordinator.self) private var playback
    @State private var model = HomeViewModel()
    @FocusState private var isCodeFocused: Bool

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
                greeting
                if let active = rooms.active {
                    activeRoomCard(active)
                }
                startListening
                if let error = model.error {
                    InlineErrorBanner(error: error, onDismiss: { model.error = nil })
                }
                recentRooms
            }
            .padding(Theme.Spacing.md)
        }
        .scrollDismissesKeyboard(.interactively)
        .sdScreenBackground()
        .navigationTitle("Home")
        .toolbarTitleDisplayMode(.inlineLarge)
        .onAppear { model.loadRecent(from: dependencies.recentRooms, userId: user.id) }
        .onChange(of: rooms.active?.roomCode) { model.loadRecent(from: dependencies.recentRooms, userId: user.id) }
    }

    private var greeting: some View {
        HStack(spacing: Theme.Spacing.sm) {
            AvatarView(name: user.username, size: 44)
            VStack(alignment: .leading, spacing: 2) {
                Text("Welcome back").font(.subheadline).foregroundStyle(Theme.Palette.inkMuted)
                Text(user.username).font(.title2.weight(.bold)).foregroundStyle(Theme.Palette.ink)
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func activeRoomCard(_ session: RoomSession) -> some View {
        Button(action: showRoom) {
            HStack(spacing: Theme.Spacing.sm) {
                ArtworkView(url: playback.item?.artworkURL, size: 52)
                VStack(alignment: .leading, spacing: 3) {
                    HStack(spacing: 6) {
                        EqualizerBars(isAnimating: playback.isPlaying)
                        Text("Listening in \(session.roomCode)")
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(Theme.Palette.accentText)
                    }
                    Text(playback.item?.title ?? "Nothing playing yet")
                        .font(.headline)
                        .lineLimit(1)
                        .foregroundStyle(Theme.Palette.ink)
                    Text("Hosted by \(session.hostUsername) · \(session.onlineCount) online")
                        .font(.footnote)
                        .foregroundStyle(Theme.Palette.inkMuted)
                }
                Spacer(minLength: 0)
                Image(systemName: "chevron.right").foregroundStyle(Theme.Palette.inkFaint)
            }
            .sdCard()
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens the room")
    }

    private var startListening: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            SectionHeader(title: "Start listening")
            LoadingButton(title: "Create a room", systemImage: "plus", isLoading: model.isCreating) {
                Task {
                    if await model.createRoom(rooms: rooms, user: user) { showRoom() }
                }
            }
            .disabled(model.isBusy && !model.isCreating)

            HStack(spacing: Theme.Spacing.xs) {
                TextField("Room code", text: $model.joinCode)
                    .font(.mono(.title3, weight: .semibold))
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled()
                    .focused($isCodeFocused)
                    .submitLabel(.join)
                    .onSubmit(join)
                    .onChange(of: model.joinCode) { _, value in
                        let cleaned = String(RoomCode.normalize(value).prefix(RoomCode.length))
                        if cleaned != value { model.joinCode = cleaned }
                    }
                    .padding(.horizontal, Theme.Spacing.md)
                    .frame(minHeight: Theme.minTouchTarget + 6)
                    .background(Theme.Palette.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous).strokeBorder(Theme.Palette.lineStrong))
                    .accessibilityLabel("Room code")

                Button(action: join) {
                    if model.joiningCode != nil && model.joiningCode == RoomCode.normalize(model.joinCode) {
                        ProgressView()
                    } else {
                        Text("Join")
                    }
                }
                .buttonStyle(SDButtonStyle(kind: .secondary, fullWidth: false))
                .disabled(!model.canJoin)
            }
            if let message = model.joinCodeValidation {
                Text(message).font(.footnote).foregroundStyle(Theme.Palette.inkFaint)
            }
        }
    }

    @ViewBuilder
    private var recentRooms: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.sm) {
            SectionHeader(title: "Recent rooms")
            if model.recent.isEmpty {
                EmptyStateView(
                    systemImage: "clock.arrow.circlepath",
                    title: "No recent rooms",
                    message: "Rooms you join on this iPhone show up here. Public room browsing isn't available yet — rooms are shared by code."
                )
                .sdCard()
            } else {
                VStack(spacing: 0) {
                    ForEach(model.recent) { room in
                        recentRow(room)
                        if room.id != model.recent.last?.id {
                            Divider().overlay(Theme.Palette.line)
                        }
                    }
                }
                .sdCard(padding: Theme.Spacing.xs)
            }
        }
    }

    private func recentRow(_ room: RecentRoomSummary) -> some View {
        Button {
            Task {
                if await model.join(code: room.roomCode, rooms: rooms, user: user) { showRoom() }
            }
        } label: {
            HStack(spacing: Theme.Spacing.sm) {
                AvatarView(name: room.hostUsername, size: 36)
                VStack(alignment: .leading, spacing: 2) {
                    Text(room.roomCode).font(.mono(.body, weight: .semibold)).foregroundStyle(Theme.Palette.ink)
                    Text(room.lastTrackTitle.map { "\(room.hostUsername) · \($0)" } ?? "Hosted by \(room.hostUsername)")
                        .font(.footnote)
                        .lineLimit(1)
                        .foregroundStyle(Theme.Palette.inkMuted)
                }
                Spacer(minLength: 0)
                if model.joiningCode == room.roomCode {
                    ProgressView()
                } else if rooms.active?.roomCode == room.roomCode {
                    Text("Active").font(.caption.weight(.semibold)).foregroundStyle(Theme.Palette.accentText)
                } else {
                    Text(room.lastJoinedAt, format: .relative(presentation: .named))
                        .font(.caption)
                        .foregroundStyle(Theme.Palette.inkFaint)
                }
            }
            .padding(Theme.Spacing.xs)
            .frame(minHeight: Theme.minTouchTarget)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(model.isBusy)
        .accessibilityLabel("Room \(room.roomCode), hosted by \(room.hostUsername)")
        .accessibilityHint("Joins the room")
    }

    private func join() {
        let code = model.joinCode
        Task {
            if await model.join(code: code, rooms: rooms, user: user) {
                isCodeFocused = false
                showRoom()
            }
        }
    }
}
