import SwiftUI

/// The shared queue. All mutations are host-only on the server; non-hosts get
/// a read-only list rather than controls that would be rejected.
struct QueueSection: View {
    let session: RoomSession
    let onError: (PresentableError) -> Void
    let openSearch: () -> Void
    @State private var isMutating = false

    var body: some View {
        Section {
            if session.queue.isEmpty {
                EmptyStateView(
                    systemImage: "list.bullet",
                    title: "Queue is empty",
                    message: session.isHost ? "Add tracks to keep the room going." : "The host hasn't queued anything yet.",
                    actionTitle: session.isHost ? "Add music" : nil,
                    action: session.isHost ? openSearch : nil
                )
            } else {
                ForEach(Array(session.queue.enumerated()), id: \.offset) { index, item in
                    QueueRow(index: index, item: item)
                        .swipeActions(edge: .trailing) {
                            if session.isHost {
                                Button(role: .destructive) { mutate { try await session.removeFromQueue(at: index) } } label: {
                                    Label("Remove", systemImage: "trash")
                                }
                            }
                        }
                        .contextMenu {
                            if session.isHost {
                                if index > 0 {
                                    Button { mutate { try await session.moveInQueue(from: index, to: 0) } } label: {
                                        Label("Play next", systemImage: "text.line.first.and.arrowtriangle.forward")
                                    }
                                    Button { mutate { try await session.moveInQueue(from: index, to: index - 1) } } label: {
                                        Label("Move up", systemImage: "arrow.up")
                                    }
                                }
                                if index < session.queue.count - 1 {
                                    Button { mutate { try await session.moveInQueue(from: index, to: index + 1) } } label: {
                                        Label("Move down", systemImage: "arrow.down")
                                    }
                                }
                                Button(role: .destructive) { mutate { try await session.removeFromQueue(at: index) } } label: {
                                    Label("Remove", systemImage: "trash")
                                }
                            }
                        }
                        .accessibilityActions {
                            if session.isHost {
                                if index > 0 {
                                    Button("Move up") { mutate { try await session.moveInQueue(from: index, to: index - 1) } }
                                }
                                Button("Remove") { mutate { try await session.removeFromQueue(at: index) } }
                            }
                        }
                }
                if session.isHost {
                    Button(role: .destructive) { mutate { try await session.clearQueue() } } label: {
                        Text("Clear queue").frame(maxWidth: .infinity)
                    }
                    .disabled(isMutating)
                }
            }
        } header: {
            HStack {
                SectionHeader(title: "Up next", trailing: session.queue.isEmpty ? nil : "\(session.queue.count)")
                if isMutating { ProgressView().controlSize(.mini) }
            }
        }
        .listRowBackground(Theme.Palette.surface)
    }

    private func mutate(_ operation: @escaping @MainActor () async throws -> Void) {
        guard !isMutating else { return }
        isMutating = true
        Task {
            do {
                try await operation()
            } catch {
                onError(PresentableError(error))
            }
            isMutating = false
        }
    }
}

struct QueueRow: View {
    let index: Int
    let item: QueueItem

    var body: some View {
        HStack(spacing: Theme.Spacing.sm) {
            Text("\(index + 1)")
                .font(.mono(.footnote))
                .foregroundStyle(Theme.Palette.inkFaint)
                .frame(width: 22)
            ArtworkView(url: URL(string: item.thumbnailUrl), size: 44, cornerRadius: Theme.Radius.sm)
            VStack(alignment: .leading, spacing: 2) {
                Text(item.title.isEmpty ? "Untitled track" : item.title)
                    .font(.subheadline.weight(.medium))
                    .lineLimit(2)
                    .foregroundStyle(Theme.Palette.ink)
                if index == 0 {
                    Text("Up next").font(.caption.weight(.semibold)).foregroundStyle(Theme.Palette.accentText)
                }
            }
            Spacer(minLength: 0)
            Text(DurationFormatting.clock(fromISO8601: item.duration))
                .font(.mono(.caption))
                .foregroundStyle(Theme.Palette.inkFaint)
        }
        .padding(.vertical, 2)
        .accessibilityElement(children: .combine)
    }
}
