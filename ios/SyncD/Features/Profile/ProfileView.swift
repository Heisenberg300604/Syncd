import SwiftUI
import UniformTypeIdentifiers

struct ProfileView: View {
    let user: PublicUser

    @Environment(AppDependencies.self) private var dependencies
    @Environment(SessionStore.self) private var session
    @Environment(PlaybackCoordinator.self) private var playback
    @State private var isSignOutConfirmationPresented = false
    @State private var isImporterPresented = false
    @State private var importError: PresentableError?

    var body: some View {
        List {
            Section {
                HStack(spacing: Theme.Spacing.md) {
                    AvatarView(name: user.username, size: 56)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(user.username).font(.title3.weight(.bold))
                        Text("Signed in").font(.footnote).foregroundStyle(Theme.Palette.inkMuted)
                    }
                }
                .padding(.vertical, Theme.Spacing.xs)
                .accessibilityElement(children: .combine)
            }

            Section {
                if case .room = playback.session {
                    Text("Stop listening to your room to test local playback.")
                        .font(.footnote)
                        .foregroundStyle(Theme.Palette.inkMuted)
                } else {
                    Button { isImporterPresented = true } label: {
                        Label("Play an audio file from this iPhone", systemImage: "folder")
                    }
                    if playback.session == .local {
                        Button(role: .destructive) { playback.stopLocal() } label: {
                            Label("Stop local playback", systemImage: "stop.fill")
                        }
                    }
                }
                if let importError {
                    InlineErrorBanner(error: importError, onDismiss: { self.importError = nil })
                }
            } header: {
                SectionHeader(title: "Playback lab")
            } footer: {
                Text("Plays a file through SyncD's native audio engine so you can check background audio, the lock screen and Control Center on a real device. Local files are never shared with a room.")
            }

            Section {
                LabeledContent("Environment", value: dependencies.configuration.environment.rawValue.capitalized)
                LabeledContent("Server", value: dependencies.configuration.apiBaseURL.host() ?? "—")
                LabeledContent("Version", value: Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—")
            } header: {
                SectionHeader(title: "About")
            }

            Section {
                Button("Sign out", role: .destructive) { isSignOutConfirmationPresented = true }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .sdScreenBackground()
        .navigationTitle("Profile")
        .confirmationDialog("Sign out of SyncD?", isPresented: $isSignOutConfirmationPresented, titleVisibility: .visible) {
            Button("Sign out", role: .destructive) { Task { await session.signOut() } }
        } message: {
            Text("You'll stop listening to any room on this iPhone.")
        }
        .fileImporter(isPresented: $isImporterPresented, allowedContentTypes: [.audio]) { result in
            switch result {
            case let .success(url):
                do {
                    let local = try LocalAudioImporter.importFile(at: url)
                    playback.playLocalFile(local, title: url.deletingPathExtension().lastPathComponent)
                } catch {
                    importError = PresentableError(title: "Couldn't open file", message: "SyncD couldn't read that audio file.", isRetryable: true)
                }
            case .failure:
                importError = PresentableError(title: "Couldn't open file", message: "The file picker returned an error.", isRetryable: true)
            }
        }
    }
}

/// Copies a picked file into the app's caches so AVPlayer keeps access after
/// the security-scoped bookmark is released.
enum LocalAudioImporter {
    static func importFile(at url: URL) throws -> URL {
        let didAccess = url.startAccessingSecurityScopedResource()
        defer { if didAccess { url.stopAccessingSecurityScopedResource() } }
        let directory = FileManager.default.temporaryDirectory.appending(path: "LocalPlayback", directoryHint: .isDirectory)
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        let destination = directory.appending(path: url.lastPathComponent)
        if FileManager.default.fileExists(atPath: destination.path()) {
            try FileManager.default.removeItem(at: destination)
        }
        try FileManager.default.copyItem(at: url, to: destination)
        return destination
    }
}
