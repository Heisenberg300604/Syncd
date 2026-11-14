import SwiftUI

/// Full-screen player sheet. Dismissing it never stops playback — it only
/// reads the shared coordinator.
struct FullPlayerView: View {
    let showRoom: () -> Void

    @Environment(PlaybackCoordinator.self) private var playback
    @Environment(RoomsController.self) private var rooms
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        GeometryReader { proxy in
            let artworkSize = min(proxy.size.width - Theme.Spacing.lg * 2, 340)
            ScrollView {
                VStack(spacing: Theme.Spacing.lg) {
                    header
                    Group {
                        if playback.audioAvailability == .embedded {
                            YouTubePlayerSurface(cornerRadius: Theme.Radius.xl)
                                .frame(maxWidth: proxy.size.width - Theme.Spacing.lg * 2)
                        } else {
                            ArtworkView(url: playback.item?.artworkURL, size: artworkSize, cornerRadius: Theme.Radius.xl)
                        }
                    }
                    .shadow(color: .black.opacity(0.45), radius: 30, y: 16)
                    .padding(.top, Theme.Spacing.xs)

                    VStack(spacing: Theme.Spacing.xxs) {
                        Text(playback.item?.title ?? "Nothing playing")
                            .font(.title2.weight(.bold))
                            .multilineTextAlignment(.center)
                            .foregroundStyle(Theme.Palette.ink)
                        HStack(spacing: 6) {
                            if let source = playback.item?.source.displayName {
                                Text(source)
                            }
                            Text("·")
                            PlaybackStatusLabel()
                        }
                        .font(.subheadline)
                        .foregroundStyle(Theme.Palette.inkMuted)
                    }

                    PlaybackProgressView()

                    HStack(spacing: Theme.Spacing.xl) {
                        Spacer()
                        PlayPauseButton(size: 72, prominent: true)
                        SkipButton(size: 48)
                        Spacer()
                    }

                    AudioAvailabilityNote()

                    if let error = playback.commandError {
                        InlineErrorBanner(error: error, onDismiss: { playback.commandError = nil })
                    }

                    if let session = rooms.active, case .room = playback.session {
                        roomInfo(session)
                    }
                }
                .padding(Theme.Spacing.lg)
                .frame(maxWidth: .infinity)
            }
        }
        .sdScreenBackground()
    }

    private var header: some View {
        HStack {
            Button { dismiss() } label: {
                Image(systemName: "chevron.down")
                    .font(.headline)
                    .frame(width: Theme.minTouchTarget, height: Theme.minTouchTarget)
            }
            .accessibilityLabel("Close player")
            Spacer()
            Text(headerTitle).font(.footnote.weight(.semibold)).foregroundStyle(Theme.Palette.inkMuted)
            Spacer()
            Color.clear.frame(width: Theme.minTouchTarget, height: Theme.minTouchTarget)
        }
        .foregroundStyle(Theme.Palette.ink)
    }

    private var headerTitle: String {
        switch playback.session {
        case let .room(code): "Room \(code)"
        case .local: "On this iPhone"
        case .none: "Player"
        }
    }

    private func roomInfo(_ session: RoomSession) -> some View {
        Button(action: showRoom) {
            HStack(spacing: Theme.Spacing.sm) {
                AvatarView(name: session.hostUsername, size: 36)
                VStack(alignment: .leading, spacing: 2) {
                    HStack(spacing: 6) {
                        Text(session.hostUsername).font(.subheadline.weight(.semibold))
                        HostBadge()
                    }
                    Text(session.isHost ? "You control playback" : "Listening along · \(session.queue.count) up next")
                        .font(.footnote)
                        .foregroundStyle(Theme.Palette.inkMuted)
                }
                Spacer()
                ConnectionStatusPill(state: session.connection)
            }
            .foregroundStyle(Theme.Palette.ink)
            .sdCard()
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens the room")
    }
}
