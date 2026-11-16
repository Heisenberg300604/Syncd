import SwiftUI

/// Persistent mini-player. Reads the shared coordinator; never owns playback.
struct MiniPlayerView: View {
    @Environment(PlaybackCoordinator.self) private var playback
    let expand: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: Theme.Spacing.sm) {
                Button(action: expand) {
                    HStack(spacing: Theme.Spacing.sm) {
                        ArtworkView(url: playback.item?.artworkURL, size: 42, cornerRadius: Theme.Radius.sm)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(playback.item?.title ?? "")
                                .font(.subheadline.weight(.semibold))
                                .lineLimit(1)
                                .foregroundStyle(Theme.Palette.ink)
                            subtitle
                        }
                        Spacer(minLength: 0)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Now playing: \(playback.item?.title ?? "")")
                .accessibilityHint("Opens the full player")

                PlayPauseButton(size: 40)
                if case .room = playback.session, playback.isHost {
                    SkipButton(size: 36)
                }
            }
            .padding(.horizontal, Theme.Spacing.sm)
            .padding(.vertical, Theme.Spacing.xs)

            GeometryReader { proxy in
                let fraction = progressFraction
                Rectangle()
                    .fill(Theme.Palette.accent)
                    .frame(width: proxy.size.width * fraction)
                    .animation(.linear(duration: 0.5), value: fraction)
            }
            .frame(height: 2)
            .accessibilityHidden(true)
        }
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous))
        .clipShape(RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous).strokeBorder(Theme.Palette.line))
        .shadow(color: .black.opacity(0.35), radius: 18, y: 8)
    }

    @ViewBuilder
    private var subtitle: some View {
        if case let .failed(error) = playback.status {
            Text(error.title).font(.caption).foregroundStyle(Theme.Palette.danger)
        } else if playback.status == .buffering || playback.status == .loading {
            Text("Buffering…").font(.caption).foregroundStyle(Theme.Palette.inkMuted)
        } else if case .unavailable = playback.audioAvailability {
            Label("Following room · no audio", systemImage: "speaker.slash")
                .font(.caption)
                .foregroundStyle(Theme.Palette.inkMuted)
        } else if playback.isLocallyPaused {
            Text("Paused on this iPhone").font(.caption).foregroundStyle(Theme.Palette.inkMuted)
        } else {
            Text(playback.item?.subtitle ?? "").font(.caption).foregroundStyle(Theme.Palette.inkMuted).lineLimit(1)
        }
    }

    private var progressFraction: CGFloat {
        guard let duration = playback.duration, duration > 0 else { return 0 }
        return CGFloat(min(1, max(0, playback.position / duration)))
    }
}
