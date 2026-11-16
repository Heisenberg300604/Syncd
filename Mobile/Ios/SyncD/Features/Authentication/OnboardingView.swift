import Observation
import SwiftUI

@MainActor
@Observable
final class OnboardingViewModel {
    var username = ""
    private(set) var isSubmitting = false
    private(set) var serverError: String?

    /// Client-side check for UX; the server re-validates.
    var validationMessage: String? {
        username.isEmpty ? nil : UsernameRules.validationMessage(for: username)
    }

    var canSubmit: Bool {
        !isSubmitting && !username.isEmpty && validationMessage == nil
    }

    func submit(using session: SessionStore) async {
        guard canSubmit else { return }
        isSubmitting = true
        serverError = nil
        defer { isSubmitting = false }
        do {
            try await session.completeOnboarding(username: username)
        } catch {
            serverError = error.message
        }
    }

    func clearServerError() {
        serverError = nil
    }
}

struct OnboardingView: View {
    @Environment(SessionStore.self) private var session
    @State private var model = OnboardingViewModel()
    @FocusState private var isFocused: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.Spacing.lg) {
            Spacer()
            BrandMark(size: 48)
            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                Text("Pick a username")
                    .font(.largeTitle.weight(.bold))
                    .foregroundStyle(Theme.Palette.ink)
                Text("This is how people in your rooms will see you.")
                    .foregroundStyle(Theme.Palette.inkMuted)
            }

            VStack(alignment: .leading, spacing: Theme.Spacing.xs) {
                TextField("username", text: $model.username)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .textContentType(.username)
                    .focused($isFocused)
                    .submitLabel(.done)
                    .onSubmit { Task { await model.submit(using: session) } }
                    .onChange(of: model.username) { model.clearServerError() }
                    .font(.title3.weight(.medium))
                    .padding(Theme.Spacing.md)
                    .background(Theme.Palette.raised, in: RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous))
                    .overlay(RoundedRectangle(cornerRadius: Theme.Radius.md, style: .continuous).strokeBorder(Theme.Palette.lineStrong))
                    .accessibilityLabel("Username")

                Group {
                    if let message = model.serverError ?? model.validationMessage {
                        Label(message, systemImage: "exclamationmark.circle")
                            .foregroundStyle(Theme.Palette.danger)
                    } else {
                        Text("\(UsernameRules.minLength)–\(UsernameRules.maxLength) characters: letters, numbers, underscores.")
                            .foregroundStyle(Theme.Palette.inkFaint)
                    }
                }
                .font(.footnote)
            }

            Spacer()

            LoadingButton(title: "Continue", isLoading: model.isSubmitting) {
                Task { await model.submit(using: session) }
            }
            .disabled(!model.canSubmit && !model.isSubmitting)

            Button("Sign out") { Task { await session.signOut() } }
                .buttonStyle(SDButtonStyle(kind: .ghost))
        }
        .padding(Theme.Spacing.lg)
        .sdScreenBackground()
        .onAppear { isFocused = true }
    }
}
