# SyncD iOS — Product Requirements Document

| | |
| --- | --- |
| Product | SyncD |
| Platform | iOS |
| Document version | 1.0 |
| Status | Initial product specification |
| Minimum iOS | iOS 17 |
| Objective | A native iOS application for synchronized social music listening |

> Implementation notes against the actual backend are in
> [Documentation/IMPLEMENTATION_PLAN.md](Documentation/IMPLEMENTATION_PLAN.md) and
> [Documentation/BACKEND_CONTRACT.md](Documentation/BACKEND_CONTRACT.md).

## 1. Product overview

### 1.1 What is SyncD?

SyncD is a real-time social listening platform. People listen to music together wherever they are: they create listening rooms, invite friends, join public rooms, share queues, chat, and control synchronized playback.

SyncD is not just a music player. It combines native music playback with real-time social interaction.

The iOS app is a standalone native implementation. It shares the existing SyncD backend and playback protocol with the web and Android applications.

### 1.2 Vision

Make listening to music with friends feel as natural as listening together in the same room. The experience should be social, synchronized, responsive, reliable, music-focused, and native to iOS.

### 1.3 Principles

- A native iOS experience, not a web app in a wrapper.
- Reliable background audio for eligible sources.
- A persistent mini-player across navigation.
- Server-authoritative synchronized listening.
- A consistent experience across iOS, Android and web.
- Clear room permissions and playback ownership.
- Graceful handling of unreliable networks and unavailable sources.

## 2. Target users

- **Casual listeners:** listen with friends without managing complicated controls.
- **Music enthusiasts:** discover tracks, share playlists, take part in communities.
- **Room hosts:** create rooms and control shared playback.
- **Room participants:** join rooms and take part in shared sessions.

## 3. Scope

### 3.1 MVP

- Authentication
- Profiles
- Home
- Room discovery
- Creating and joining rooms
- Participant lists
- Native audio playback
- Background playback for eligible sources
- Lock-screen controls and Control Center
- Persistent mini-player and full-screen player
- Shared queue
- Real-time synchronization
- Basic chat
- Reconnection and playback recovery
- Error, loading, empty and success states

### 3.2 Post-MVP

- Advanced recommendations and discovery filters
- Listening history
- Rich social profiles and friend management
- Advanced playlist management
- Push notifications
- Advanced offline support
- Audio quality preferences
- Advanced host-PC connection and relay management

Do not delay the working playback prototype for any of these.

## 4. Navigation

Suggested tabs are Home, Discover, Activity/Chat, and Profile. A persistent mini-player sits above the tab bar whenever there's an active or resumable session. The exact layout can be refined during design.

Navigation requirements:

- Navigation preserves screen state.
- Opening the full player never creates a second player.
- Switching tabs never stops playback.
- Returning to a room restores its current state.
- Navigation works with accessibility features.
- Sheets follow native conventions.

## 5. Authentication

Use the existing SyncD auth infrastructure (Clerk): sign in, sign up where configured, session restoration, sign out, error handling, and secure token storage.

Acceptance:

- A valid user can authenticate.
- An invalid login shows an actionable error.
- An expired session follows the existing refresh flow.
- Relaunching the app restores a valid session.
- Credentials and tokens are never stored in plain text.

## 6. Home

Home contains:

- a welcome section and user info
- featured rooms, if the backend supports them
- recent rooms, if available
- active sessions
- quick room creation
- navigation to discovery
- the mini-player

It needs loading, success, empty, error and offline (cached data) states.

Acceptance:

- Data comes from the real backend.
- Room navigation works.
- Room cards reflect real room state.
- Loading and error states exist.
- The mini-player stays consistent with the active session.

## 7. Room discovery

List available rooms with name, host, participant count, visibility, current track, status, and a join action.

Acceptance:

- Only rooms available to the user are shown.
- Private access follows backend authorization.
- Joining an unavailable room shows a clear error.
- Lists refresh correctly.
- An empty result has a dedicated state.

## 8. Listening rooms

A room shows its name, host, participants, current track, playback status, queue, chat, and controls.

**Host:** can play, pause, seek, skip, manage the queue, remove participants, and change settings, all as the backend permits.

**Participant:** can view state, listen, view the queue, chat, and add to the queue where permitted.

All permissions come from the backend. iOS does not hardcode a different role system.

Lifecycle:

1. Create or join the room.
2. Fetch room info.
3. Subscribe to events.
4. Receive authoritative state.
5. Load an eligible source.
6. Synchronize.
7. Reflect room updates in the UI.
8. Leave or disconnect.
9. Clean up resources and subscriptions.

Acceptance:

- Users can join authorized rooms.
- Room state updates in real time.
- Presence is accurate.
- Host controls are enforced.
- There are no duplicate subscriptions.
- Rejoining restores the latest state.

## 9. Native music player

Frameworks: AVPlayer, AVPlayerItem, AVAudioSession, MPNowPlayingInfoCenter, MPRemoteCommandCenter, all behind a dedicated playback engine.

- **Controls:** play, pause, seek, next, previous (where applicable), volume (where supported).
- **Metadata:** title, artist, artwork, duration, elapsed time, status, source. Missing metadata never crashes the player.
- **States:** idle, loading, ready, playing, paused, buffering, seeking, ended, failed. The UI reflects the real player state.

Acceptance:

- An authorized source loads.
- Play and pause work.
- Seek moves the real position.
- Buffering is visible.
- Invalid sources show an actionable error.
- Track changes update the metadata.
- State stays consistent across navigation.

## 10. Background playback (high priority, MVP)

For eligible sources:

- Playback continues in the background and when the device is locked.
- The audio session is configured correctly and player resources stay valid.
- Metadata is available to the system.
- Lock-screen and Control Center controls work.
- Playback recovers from supported interruptions.

Interruptions to handle: phone calls, Siri, other apps taking audio focus, headphone disconnection, Bluetooth route changes, and session interruption notifications. The app must tell a temporary interruption apart from an intentional pause.

Acceptance:

- Audio continues in the background.
- Lock-screen metadata is correct.
- Lock-screen and Control Center controls work.
- Resume follows the interruption policy.
- Returning to the app restores accurate state.

**Source restrictions:** YouTube playback follows YouTube's player and API policies. SyncD must not extract audio or provide prohibited background playback. The UI identifies sources that don't support background playback and explains why.

## 11. Mini-player (high priority, MVP)

The mini-player shows artwork, title, artist, play/pause, progress, and expands into the full player. It:

- appears when an eligible session exists
- persists across navigation
- reflects buffering and errors
- never creates another AVPlayer
- updates on room changes
- disappears or changes appropriately when the session ends

Acceptance:

- It persists across tabs.
- Its controls affect the real engine.
- Expanding opens the correct player.
- It shows metadata updates.
- Buffering and failure are shown.

## 12. Full-screen player

The full player shows large artwork, title, artist, a progress slider, elapsed and remaining time, play/pause, previous/next, queue access, room info, and a role indicator.

It shows the active room's track and its real state, uses room permissions for controls and seeking, gives buffering feedback, and doesn't stop playback when dismissed.

## 13. Shared queue

The queue shows the current track and upcoming tracks with artwork, title, artist and order. Users can add, remove (where authorized) and skip (where authorized), with real-time updates.

Rules:

- The backend is authoritative and validates every change.
- Duplicate handling follows existing rules.
- Unauthorized changes are rejected visibly.
- Concurrent changes never silently overwrite newer state.

Acceptance:

- The queue loads from the backend.
- It updates in real time.
- Permissions are respected.
- An empty queue has its own state.
- Failed operations can be retried.

## 14. Music search

Search input and results with artwork, title, artist, source info, and an add-to-queue action.

Acceptance:

- Search uses the existing backend and provider integration.
- Loading and empty states exist.
- Failures are recoverable.
- Unsupported sources are identified.
- Queue actions respect permissions.

## 15. Chat and presence

**Chat:** view and send messages, sender identity, timestamps, real-time delivery, and failed-delivery handling.

**Presence:** current participants, host status, real-time updates, disconnect/reconnect handling, and no duplicates.

Acceptance:

- Messages land in the correct room.
- Send failures are visible.
- Presence changes are reflected.
- Room data is isolated per room.

## 16. Host-PC streaming

Receive an authorized stream endpoint and authenticate access to it. Support seeking when HTTP Range is supported. Handle unavailable hosts, expired credentials, and interrupted connections, and show source and connection status.

Security:

- Never expose filesystem paths.
- Never bypass host authorization.
- Never store long-lived stream credentials in plain text.
- Don't assume hosts are directly reachable; use an authorized relay when needed.

Acceptance:

- An authorized stream plays.
- Seek works when the source supports it.
- An unavailable host shows a clear error.
- Reconnection never starts the wrong track.
- Access is validated by existing authorization.

## 17. Playback synchronization (core MVP)

The backend is authoritative. The local AVPlayer reports its state but never redefines the shared state.

A snapshot conceptually contains:

- room ID
- track ID
- status
- position
- server timestamp
- rate
- controller ID
- revision (if supported)

```
expectedPosition = initialPosition + elapsedServerTime × playbackRate
```

Use the existing server-time and clock-offset contract.

| Drift | Behaviour |
| --- | --- |
| < 250 ms | No correction |
| 250–750 ms | Monitor |
| 750 ms – 2 s | Consider gradual correction |
| > 2 s | Consider an authoritative seek |

These thresholds are starting points and must be validated on real devices and networks.

Reconnection:

- Don't destroy active playback.
- Continue eligible audio.
- Show the connection state.
- Reconnect using the existing protocol.
- Fetch authoritative state.
- Reconcile track and position.
- Reject stale events.

Acceptance:

- All participants receive the same state.
- Host commands propagate.
- Unauthorized commands are rejected.
- Drift is corrected.
- Reconnection restores the correct track and position.
- Stale events can't overwrite newer state.

## 18. Authentication, networking and data

- Clerk plus the existing backend contracts.
- URLSession for HTTP and Socket.IO Client Swift for real-time events.
- SwiftData for preferences, cached rooms, recent rooms, non-sensitive metadata, and UI preferences.
- Keychain for credentials.

Local persistence is never authoritative for room playback.

## 19. Design and UX

The app should feel premium and music-first:

- dark-first
- strong artwork
- clean layouts and clear typography
- refined spacing and subtle animation
- smooth player transitions
- a consistent visual language and native interaction patterns

Inspiration, not templates: Apple Music, Spotify, Discord, and the existing SyncD web design. Don't copy any other app's interface.

Component states:

| State | Behaviour |
| --- | --- |
| Default | Normal |
| Loading | Clear loading feedback |
| Success | Reflects the successful operation |
| Empty | Explains the missing content |
| Error | Explains the failure and how to recover |
| Disabled | Explains why the action is unavailable |
| Offline | Communicates connectivity limits |
| Buffering | Shows playback loading |

Accessibility:

- Dynamic Type
- VoiceOver labels and accessible control names
- adequate contrast and touch targets
- reduced motion
- status announcements

## 20. Non-functional requirements

- **Performance:** no needless redraws or polling, efficient artwork caching, nothing blocking the main thread, correct AVPlayer observers, no needless player recreation.
- **Reliability:** network failures, socket reconnection, audio interruptions, invalid or expired sources, no duplicate sessions, cleanup on leave.
- **Security:** secure credentials, no hardcoded secrets, validated payloads, respect for backend authorization, no sensitive data in logs, secure transport in production.
- **Maintainability:** feature-based structure, reusable components, testable services, clear models, typed errors, documented contracts.

## 21. Analytics and diagnostics

Useful technical diagnostics:

- playback started, paused or failed
- room joined or left
- socket disconnected or reconnected
- drift detected, reconciled
- audio interruption
- host stream unavailable

Never include credentials, stream tokens, or sensitive content. Add analytics infrastructure only if it fits the existing backend and privacy model.

## 22. Testing

- **Unit:** position math, drift correction, state transitions, permissions, queue handling, decoding, error mapping, stale events, reconnection reconciliation.
- **Integration:** auth, room joining, socket events, source loading, AVPlayer state, remote commands, queue updates, synchronization.
- **Physical device (mandatory):** background audio, locking, lock screen, Control Center, Bluetooth, wired headphones, calls, Siri, network loss and return, long sessions, termination and relaunch.

Simulator success does not establish production background playback reliability.

## 23. MVP acceptance checklist

- **Foundation:** SwiftUI app, architecture, environment configuration, auth integration, backend connectivity.
- **Playback:** AVPlayer engine, local playback, authorized remote streaming, play/pause, seek, buffering, error recovery.
- **Background:** audio capability, session configuration, lock-screen metadata and controls, Control Center, interruption handling, route-change handling.
- **UI:** Home, discovery, room, mini-player, full player, queue, chat, all states.
- **Sync:** Socket.IO, room playback state, host controls, participant permissions, drift correction, reconnection recovery.
- **Quality:** unit tests, integration tests, device validation, no hardcoded secrets, README, known limitations.

## 24. Milestones

1. **Native foundation:** project, architecture, design system, networking, auth.
2. **Playback engine:** AVPlayer, audio session, background capability, Now Playing, remote commands.
3. **Player experience:** mini-player, full player, metadata, queue UI.
4. **Real-time listening:** discovery, joining, Socket.IO, synchronization, drift correction.
5. **Social:** participants, chat, profiles, search.
6. **Reliability and release:** reconnection, interruption recovery, host-PC streaming, accessibility, device testing, performance and security review.

## 25. Success criteria

1. Users can authenticate and join a real room.
2. Authorized audio plays through native AVPlayer.
3. Eligible audio continues in the background.
4. Lock-screen and Control Center controls work.
5. The mini-player persists across navigation.
6. Participants receive synchronized updates.
7. Reconnection restores the correct state.
8. Errors never fail silently.
9. The app stays compatible with the existing backend and the Android protocol.

SyncD iOS must be a real native music-listening application, not merely screens connected to a backend. Playback reliability, room synchronization, and listening quality are its foundation.
