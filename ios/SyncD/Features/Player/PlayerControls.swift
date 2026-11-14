import SwiftUI

/// Play/pause that reflects the coordinator's real state (buffering shows a
/// spinner, not a play icon).
struct PlayPauseButton: View {
    @Environment(PlaybackCoordinator.self) private var playback
    var size: CGFloat = 44
    var prominent = false

    var body: some View {
        Button {
            playback.togglePlayPause()
        } label: {
            ZStack {
                if prominent {
                    Circle().fill(Theme.Palette.accent)
                        .shadow(color: Theme.Palette.accent.opacity(0.45), radius: 18, y: 6)
                }
                if isBusy {
                    ProgressView().tint(prominent ? Theme.Palette.accentInk : Theme.Palette.ink)
                } else {
                    Image(systemName: showsPause ? "pause.fill" : "play.fill")
                        .font(.system(size: size * (prominent ? 0.38 : 0.5), weight: .bold))
                        .foregroundStyle(prominent ? Theme.Palette.accentInk : Theme.Palette.ink)
                        .contentTransition(.symbolEffect(.replace))
                }
            }
            .frame(width: size, height: size)
            .contentShape(Circle())
        }
        .buttonStyle(.plain)
        .disabled(!playback.canTogglePlayback)
        .opacity(playback.canTogglePlayback ? 1 : 0.4)
        .accessibilityLabel(showsPause ? "Pause" : "Play")
        .accessibilityValue(isBusy ? "Loading" : "")
        .accessibilityHint(hint)
    }

    private var isBusy: Bool {
        playback.status == .loading || playback.status == .buffering
    }

    /// Host sees room state; a locally-paused participant sees "play" to rejoin.
    private var showsPause: Bool {
        if case .room = playback.session, playback.isHost { return playback.isRoomPlaying }
        if playback.isLocallyPaused { return false }
        return playback.isPlaying
    }

    private var hint: String {
        if case .room = playback.session {
            return playback.isHost ? "Controls playback for everyone in the room" : "Pauses or resumes audio on this iPhone only"
        }
        return ""
    }
}

struct SkipButton: View {
    @Environment(PlaybackCoordinator.self) private var playback
    var size: CGFloat = 40

    var body: some View {
        Button { playback.skipToNext() } label: {
            Image(systemName: "forward.fill")
                .font(.system(size: size * 0.45, weight: .semibold))
                .frame(width: size, height: size)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .foregroundStyle(Theme.Palette.ink)
        .disabled(!playback.canSkip)
        .opacity(playback.canSkip ? 1 : 0.35)
        .accessibilityLabel("Next track")
    }
}

/// Seekable for hosts / local playback; a read-only bar for participants.
struct PlaybackProgressView: View {
    @Environment(PlaybackCoordinator.self) private var playback
    var showsTimes = true

    @State private var scrubPosition: Double?

    var body: some View {
        let duration = max(playback.duration ?? 0, 0)
        let current = scrubPosition ?? min(playback.position, duration > 0 ? duration : playback.position)

        VStack(spacing: 4) {
            if playback.canSeek, duration > 0 {
                Slider(
                    value: Binding(get: { current }, set: { scrubPosition = $0 }),
                    in: 0...duration,
                    onEditingChanged: { editing in
                        if !editing, let target = scrubPosition {
                            playback.seek(to: target)
                            scrubPosition = nil
                        }
                    }
                )
                .tint(Theme.Palette.accent)
                .accessibilityLabel("Playback position")
                .accessibilityValue("\(DurationFormatting.clock(current)) of \(DurationFormatting.clock(duration))")
            } else {
                ProgressView(value: duration > 0 ? current / duration : 0)
                    .tint(Theme.Palette.accent)
                    .accessibilityLabel("Playback position")
                    .accessibilityValue(duration > 0 ? "\(DurationFormatting.clock(current)) of \(DurationFormatting.clock(duration))" : "Unknown length")
            }
            if showsTimes {
                HStack {
                    Text(DurationFormatting.clock(current))
                    Spacer()
                    Text(duration > 0 ? "-" + DurationFormatting.clock(max(0, duration - current)) : "--:--")
                }
                .font(.mono(.caption))
                .foregroundStyle(Theme.Palette.inkFaint)
                .accessibilityHidden(true)
            }
        }
    }
}

/// Explains why this device isn't producing audio, when that's the case.
struct AudioAvailabilityNote: View {
    @Environment(PlaybackCoordinator.self) private var playback

    var body: some View {
        if case let .unavailable(reason) = playback.audioAvailability {
            Label {
                Text(reason)
            } icon: {
                Image(systemName: "speaker.slash")
            }
            .font(.footnote)
            .foregroundStyle(Theme.Palette.inkMuted)
            .padding(Theme.Spacing.sm)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.Palette.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
        } else if playback.audioAvailability == .embedded, !playback.isLocallyPaused {
            Label("Playing through YouTube's player. Audio pauses while SyncD is in the background.", systemImage: "play.rectangle")
                .font(.footnote)
                .foregroundStyle(Theme.Palette.inkMuted)
                .padding(Theme.Spacing.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Palette.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
        } else if playback.isLocallyPaused {
            Label("Paused on this iPhone. The room is still playing — press play to rejoin live.", systemImage: "pause.circle")
                .font(.footnote)
                .foregroundStyle(Theme.Palette.inkMuted)
                .padding(Theme.Spacing.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Palette.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
        }
    }
}

struct PlaybackStatusLabel: View {
    @Environment(PlaybackCoordinator.self) private var playback

    var body: some View {
        Text(text)
            .font(.caption.weight(.semibold))
            .foregroundStyle(color)
    }

    private var text: String {
        switch playback.status {
        case .idle: "Idle"
        case .loading: "Loading…"
        case .buffering: "Buffering…"
        case .playing: producesAudio ? "Playing" : "Room is playing"
        case .paused: producesAudio ? "Paused" : "Room is paused"
        case .ended: "Ended"
        case let .failed(error): error.title
        }
    }

    private var producesAudio: Bool {
        playback.audioAvailability == .native || playback.audioAvailability == .embedded
    }

    private var color: Color {
        switch playback.status {
        case .failed: Theme.Palette.danger
        case .playing: Theme.Palette.accentText
        default: Theme.Palette.inkMuted
        }
    }
}
