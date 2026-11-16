import Observation
import SwiftUI

@MainActor
@Observable
final class SearchViewModel {
    enum Phase: Equatable {
        case idle
        case loading
        case results([TrackSearchResult], playlistTitle: String?)
        case empty
        case failed
    }

    var query = ""
    private(set) var phase: Phase = .idle
    private(set) var error: PresentableError?
    /// videoId → in-flight action, so each row shows its own progress.
    private(set) var pending: Set<String> = []
    private(set) var added: Set<String> = []

    private let api: any SyncDAPIProtocol
    private var searchTask: Task<Void, Never>?

    init(api: any SyncDAPIProtocol) {
        self.api = api
    }

    var isLink: Bool {
        let value = query.trimmingCharacters(in: .whitespaces).lowercased()
        return value.hasPrefix("http") || value.contains("youtu.be/") || value.contains("youtube.com/")
    }

    /// Debounced so typing doesn't burn the server's YouTube quota
    /// (30 searches/min rate limit; 100 quota units each).
    func queryChanged() {
        searchTask?.cancel()
        let value = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else {
            phase = .idle
            error = nil
            return
        }
        searchTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(450))
            guard !Task.isCancelled else { return }
            await self?.run(value)
        }
    }

    func retry() {
        let value = query.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !value.isEmpty else { return }
        searchTask?.cancel()
        searchTask = Task { [weak self] in await self?.run(value) }
    }

    private func run(_ value: String) async {
        phase = .loading
        error = nil
        do {
            let results: [TrackSearchResult]
            var playlistTitle: String?
            if isLink, value.contains("list=") {
                let playlist = try await api.resolvePlaylist(link: value)
                results = playlist.results
                playlistTitle = playlist.playlistTitle
            } else if isLink {
                results = [try await api.resolveTrack(link: value)]
            } else {
                results = try await api.searchTracks(query: value)
            }
            guard !Task.isCancelled else { return }
            phase = results.isEmpty ? .empty : .results(results, playlistTitle: playlistTitle)
        } catch {
            guard !Task.isCancelled else { return }
            let mapped = APIClient.map(transportError: error)
            if mapped == .cancelled { return }
            self.error = PresentableError(mapped)
            phase = .failed
        }
    }

    func perform(_ track: TrackSearchResult, action: @escaping @MainActor () async throws -> Void) async {
        guard !pending.contains(track.videoId) else { return }
        pending.insert(track.videoId)
        defer { pending.remove(track.videoId) }
        do {
            try await action()
            added.insert(track.videoId)
        } catch {
            self.error = PresentableError(error)
        }
    }

    func dismissError() { error = nil }
}

/// Track search for hosts. The server allows only the host to change
/// playback or the queue, so participants never reach this screen.
struct SearchView: View {
    let session: RoomSession

    @Environment(AppDependencies.self) private var dependencies
    @Environment(PlaybackCoordinator.self) private var playback
    @Environment(\.dismiss) private var dismiss
    @State private var model: SearchViewModel?

    var body: some View {
        Group {
            if let model {
                content(model)
            } else {
                Color.clear
            }
        }
        .sdScreenBackground()
        .navigationTitle("Add music")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
        }
        .task {
            if model == nil { model = SearchViewModel(api: dependencies.api) }
        }
    }

    @ViewBuilder
    private func content(_ model: SearchViewModel) -> some View {
        @Bindable var model = model
        List {
            if !session.isHost {
                EmptyStateView(systemImage: "lock", title: "Host only", message: "Only the host can add music to this room.")
                    .listRowBackground(Color.clear)
            } else {
                if let error = model.error, model.phase != .failed {
                    InlineErrorBanner(error: error, onDismiss: model.dismissError)
                        .listRowInsets(EdgeInsets())
                        .listRowBackground(Color.clear)
                }
                switch model.phase {
                case .idle:
                    EmptyStateView(systemImage: "magnifyingglass", title: "Find something to play", message: "Search YouTube or paste a video or playlist link.")
                        .listRowBackground(Color.clear)
                case .loading:
                    HStack { Spacer(); ProgressView(); Spacer() }
                        .listRowBackground(Color.clear)
                case .empty:
                    EmptyStateView(systemImage: "music.note.list", title: "No results", message: "Try a different search.")
                        .listRowBackground(Color.clear)
                case .failed:
                    ErrorStateView(error: model.error ?? PresentableError(APIError.invalidResponse), retry: model.retry)
                        .listRowBackground(Color.clear)
                case let .results(results, playlistTitle):
                    Section {
                        ForEach(results) { track in
                            SearchResultRow(
                                track: track,
                                isPending: model.pending.contains(track.videoId),
                                isAdded: model.added.contains(track.videoId),
                                somethingIsPlaying: playback.item != nil,
                                playNow: { Task { await model.perform(track) { try await session.playNow(track.trackInput) } } },
                                addToQueue: { Task { await model.perform(track) { try await session.enqueue(track.trackInput) } } }
                            )
                        }
                    } header: {
                        if let playlistTitle { SectionHeader(title: playlistTitle, trailing: "\(results.count) tracks") }
                    }
                    .listRowBackground(Theme.Palette.surface)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .searchable(text: $model.query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search or paste a YouTube link")
        .onChange(of: model.query) { model.queryChanged() }
        .onSubmit(of: .search) { model.retry() }
    }
}

private struct SearchResultRow: View {
    let track: TrackSearchResult
    let isPending: Bool
    let isAdded: Bool
    let somethingIsPlaying: Bool
    let playNow: () -> Void
    let addToQueue: () -> Void

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            ArtworkView(url: URL(string: track.thumbnailUrl), size: 52, cornerRadius: Theme.Radius.sm)
            VStack(alignment: .leading, spacing: 2) {
                Text(track.title).font(.subheadline.weight(.medium)).lineLimit(2).foregroundStyle(Theme.Palette.ink)
                Text([track.channelTitle, DurationFormatting.clock(fromISO8601: track.duration)].filter { !$0.isEmpty }.joined(separator: " · "))
                    .font(.caption)
                    .foregroundStyle(Theme.Palette.inkMuted)
            }
            Spacer(minLength: 0)
            if isPending {
                ProgressView()
            } else if isAdded {
                Image(systemName: "checkmark.circle.fill").foregroundStyle(Theme.Palette.online)
                    .accessibilityLabel("Added")
            } else {
                Menu {
                    Button(action: playNow) { Label("Play now", systemImage: "play.fill") }
                    if somethingIsPlaying {
                        Button(action: addToQueue) { Label("Add to queue", systemImage: "text.badge.plus") }
                    }
                } label: {
                    Image(systemName: somethingIsPlaying ? "plus.circle.fill" : "play.circle.fill")
                        .font(.title2)
                        .foregroundStyle(Theme.Palette.accent)
                        .frame(width: Theme.minTouchTarget, height: Theme.minTouchTarget)
                } primaryAction: {
                    somethingIsPlaying ? addToQueue() : playNow()
                }
                .accessibilityLabel(somethingIsPlaying ? "Add \(track.title) to queue" : "Play \(track.title)")
            }
        }
        .padding(.vertical, 2)
    }
}
