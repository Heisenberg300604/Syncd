import SwiftUI

/// Signed-in shell. The mini-player is attached to each tab's content (not
/// owned by it): every instance reads the same `PlaybackCoordinator`, so
/// switching tabs never creates or stops a player.
struct MainTabView: View {
    enum Tab: Hashable { case home, room, profile }

    let user: PublicUser
    @State private var selection: Tab = .home
    @State private var isPlayerPresented = false
    @Environment(RoomsController.self) private var rooms

    var body: some View {
        TabView(selection: $selection) {
            NavigationStack {
                HomeView(user: user, showRoom: { selection = .room })
            }
            .miniPlayerInset(isPlayerPresented: $isPlayerPresented)
            .tabItem { Label("Home", systemImage: "house.fill") }
            .tag(Tab.home)

            NavigationStack {
                ActiveRoomTab(user: user, goHome: { selection = .home })
            }
            .tabItem { Label("Room", systemImage: "dot.radiowaves.left.and.right") }
            .tag(Tab.room)

            NavigationStack {
                ProfileView(user: user)
            }
            .miniPlayerInset(isPlayerPresented: $isPlayerPresented)
            .tabItem { Label("Profile", systemImage: "person.crop.circle") }
            .tag(Tab.profile)
        }
        .sheet(isPresented: $isPlayerPresented) {
            FullPlayerView(showRoom: {
                isPlayerPresented = false
                selection = .room
            })
            .presentationDragIndicator(.visible)
        }
    }
}

/// The room tab shows the live room, or explains how to get into one.
struct ActiveRoomTab: View {
    let user: PublicUser
    let goHome: () -> Void
    @Environment(RoomsController.self) private var rooms

    var body: some View {
        if let session = rooms.active {
            RoomView(session: session, user: user)
                .id(session.roomCode)
        } else {
            EmptyStateView(
                systemImage: "music.note.house",
                title: "You're not in a room",
                message: "Create a room or join one with a 6-character code to start listening together.",
                actionTitle: "Go to Home",
                action: goHome
            )
            .frame(maxHeight: .infinity)
            .sdScreenBackground()
            .navigationTitle("Room")
        }
    }
}

private struct MiniPlayerInset: ViewModifier {
    @Binding var isPlayerPresented: Bool
    @Environment(PlaybackCoordinator.self) private var playback

    func body(content: Content) -> some View {
        content.safeAreaInset(edge: .bottom, spacing: 0) {
            if playback.hasActiveItem {
                MiniPlayerView { isPlayerPresented = true }
                    .padding(.horizontal, Theme.Spacing.xs)
                    .padding(.bottom, Theme.Spacing.xxs)
                    .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(duration: 0.3), value: playback.hasActiveItem)
    }
}

extension View {
    func miniPlayerInset(isPlayerPresented: Binding<Bool>) -> some View {
        modifier(MiniPlayerInset(isPlayerPresented: isPlayerPresented))
    }
}
