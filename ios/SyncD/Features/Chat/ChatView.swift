import Observation
import SwiftUI

@MainActor
@Observable
final class ChatViewModel {
    var draft = ""
    private(set) var isSending = false
    private(set) var sendError: PresentableError?

    var trimmed: String { draft.trimmingCharacters(in: .whitespacesAndNewlines) }
    var remaining: Int { ChatRules.maxLength - draft.count }
    var canSend: Bool { !isSending && !trimmed.isEmpty && trimmed.count <= ChatRules.maxLength }

    /// No optimistic insert: like web, a message appears when the server
    /// broadcasts `chat:new`. On failure the draft is kept for retry.
    func send(via session: RoomSession) async {
        guard canSend else { return }
        let content = trimmed
        isSending = true
        sendError = nil
        defer { isSending = false }
        do {
            try await session.sendChat(content)
            if trimmed == content { draft = "" }
        } catch {
            sendError = PresentableError(error)
        }
    }

    func dismissError() { sendError = nil }
}

struct ChatView: View {
    let session: RoomSession
    let user: PublicUser

    @State private var model = ChatViewModel()
    @State private var isNearBottom = true
    @State private var hasUnseen = false
    @FocusState private var isInputFocused: Bool

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(alignment: .leading, spacing: Theme.Spacing.sm) {
                    if session.messages.isEmpty {
                        EmptyStateView(systemImage: "bubble.left", title: "No messages yet", message: "Start the conversation.")
                            .padding(.top, Theme.Spacing.xl)
                    }
                    ForEach(session.messages) { message in
                        ChatBubble(message: message, isMine: message.userId == user.id, isHost: message.userId == session.hostUserId)
                            .id(message.id)
                    }
                    Color.clear.frame(height: 1).id("bottom")
                        .onAppear { isNearBottom = true; hasUnseen = false }
                        .onDisappear { isNearBottom = false }
                }
                .padding(Theme.Spacing.md)
            }
            .scrollDismissesKeyboard(.interactively)
            .defaultScrollAnchor(.bottom)
            .onChange(of: session.messages.last?.id) { _, _ in
                // Only follow new messages when the reader is already at the bottom.
                if isNearBottom || session.messages.last?.userId == user.id {
                    withAnimation(.easeOut(duration: 0.2)) { proxy.scrollTo("bottom", anchor: .bottom) }
                } else {
                    hasUnseen = true
                }
            }
            .overlay(alignment: .bottom) {
                if hasUnseen {
                    Button {
                        withAnimation { proxy.scrollTo("bottom", anchor: .bottom) }
                    } label: {
                        Label("New messages", systemImage: "arrow.down")
                            .font(.footnote.weight(.semibold))
                            .padding(.horizontal, Theme.Spacing.sm)
                            .padding(.vertical, 6)
                            .background(Theme.Palette.accent, in: Capsule())
                            .foregroundStyle(Theme.Palette.accentInk)
                    }
                    .padding(.bottom, Theme.Spacing.xs)
                }
            }
            .safeAreaInset(edge: .bottom, spacing: 0) { inputBar }
        }
        .sdScreenBackground()
        .navigationTitle("Chat")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { ConnectionStatusPill(state: session.connection) }
        }
    }

    private var inputBar: some View {
        VStack(spacing: Theme.Spacing.xs) {
            if let error = model.sendError {
                InlineErrorBanner(error: error, onDismiss: model.dismissError, onRetry: send)
            }
            HStack(alignment: .bottom, spacing: Theme.Spacing.xs) {
                TextField("Message", text: $model.draft, axis: .vertical)
                    .lineLimit(1...5)
                    .focused($isInputFocused)
                    .padding(.horizontal, Theme.Spacing.sm)
                    .padding(.vertical, 10)
                    .background(Theme.Palette.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous))
                    .disabled(!session.connection.isConnected)
                    .accessibilityLabel("Message")
                Button(action: send) {
                    Group {
                        if model.isSending { ProgressView().tint(Theme.Palette.accentInk) }
                        else { Image(systemName: "arrow.up").font(.body.weight(.bold)) }
                    }
                    .frame(width: Theme.minTouchTarget, height: Theme.minTouchTarget)
                    .background(model.canSend ? Theme.Palette.accent : Theme.Palette.overlay, in: Circle())
                    .foregroundStyle(Theme.Palette.accentInk)
                }
                .disabled(!model.canSend || !session.connection.isConnected)
                .accessibilityLabel("Send")
            }
            HStack {
                if !session.connection.isConnected {
                    Text("Reconnecting — you can send once the room is live.")
                } else if model.remaining < 50 {
                    Text("\(model.remaining) characters left")
                        .foregroundStyle(model.remaining < 0 ? Theme.Palette.danger : Theme.Palette.inkFaint)
                }
                Spacer()
            }
            .font(.caption)
            .foregroundStyle(Theme.Palette.inkFaint)
        }
        .padding(.horizontal, Theme.Spacing.md)
        .padding(.top, Theme.Spacing.xs)
        .padding(.bottom, Theme.Spacing.xs)
        .background(.bar)
    }

    private func send() {
        Task { await model.send(via: session) }
    }
}

private struct ChatBubble: View {
    let message: ChatMessage
    let isMine: Bool
    let isHost: Bool

    var body: some View {
        HStack(alignment: .top, spacing: Theme.Spacing.xs) {
            if isMine { Spacer(minLength: 48) }
            if !isMine { AvatarView(name: message.username, size: 28) }
            VStack(alignment: isMine ? .trailing : .leading, spacing: 3) {
                HStack(spacing: 6) {
                    if !isMine {
                        Text(message.username).font(.caption.weight(.semibold)).foregroundStyle(Theme.Palette.inkMuted)
                        if isHost { HostBadge() }
                    }
                    Text(message.createdAt, format: .dateTime.hour().minute())
                        .font(.mono(.caption2))
                        .foregroundStyle(Theme.Palette.inkFaint)
                }
                Text(message.content)
                    .font(.body)
                    .foregroundStyle(isMine ? Theme.Palette.accentInk : Theme.Palette.ink)
                    .padding(.horizontal, Theme.Spacing.sm)
                    .padding(.vertical, Theme.Spacing.xs)
                    .background(isMine ? Theme.Palette.accent : Theme.Palette.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.lg, style: .continuous))
                    .textSelection(.enabled)
            }
            if !isMine { Spacer(minLength: 48) }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(isMine ? "You" : message.username): \(message.content)")
        .accessibilityValue(message.createdAt.formatted(date: .omitted, time: .shortened))
    }
}
