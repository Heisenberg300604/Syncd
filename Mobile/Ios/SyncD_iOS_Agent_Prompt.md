# SyncD iOS --- Native Application Implementation Prompt

You are a senior iOS engineer and software architect responsible for
building **SyncD iOS**, a production-quality native iOS application for
synchronized social music listening.

Your task is to inspect, plan, implement, test, and document the
application. Do not merely generate a UI prototype. Build a functional
application with real backend integration, native audio playback,
real-time room synchronization, robust error handling, and a polished
iOS experience.

## 1. Product context

SyncD is a social listening platform where users can create and join
listening rooms, listen to music together in real time, control playback
according to room permissions, manage a shared queue, discover music,
chat, and play authorized audio from their own device or an available
host-PC stream.

SyncD already has a web application and Node.js backend using
technologies including Express, Socket.IO, Prisma, PostgreSQL, and Clerk
authentication. There is also a separate native Android application.

The iOS application must follow the same backend contracts, event
protocol, product rules, and playback synchronization model.

**Do not create a second backend or invent a separate room protocol.**

## 2. Mandatory technology stack

-   Language: Swift
-   UI: SwiftUI
-   Minimum deployment target: iOS 17
-   Audio: AVFoundation and AVPlayer
-   Audio session: AVAudioSession
-   Background audio: iOS Background Modes --- Audio
-   Lock-screen metadata: MPNowPlayingInfoCenter
-   Remote controls: MPRemoteCommandCenter
-   Networking: URLSession
-   Real-time communication: Socket.IO Client Swift
-   Persistence: SwiftData
-   Secure credentials: Keychain
-   Concurrency: Swift Concurrency, async/await, actors
-   Dependency management: Swift Package Manager
-   Architecture: Feature-based MVVM with clear service boundaries

Do not use Expo, React Native, Flutter, Android libraries, WebView-based
application UI, or third-party audio player frameworks when native
AVFoundation is sufficient.

## 3. Inspect before implementing

Before writing code:

1.  Inspect the existing repository and identify the iOS project
    location.
2.  Read the existing web application's API contracts, authentication
    flow, Socket.IO events, room model, queue model, and playback state.
3.  Inspect the Android implementation if available.
4.  Identify existing shared types, validation rules, and protocol
    documentation.
5.  Identify actual backend endpoints and Socket.IO event names. Never
    invent endpoint URLs or event names.
6.  Produce a concise implementation plan and list missing contracts.
7.  Preserve existing conventions and avoid unnecessary restructuring.

If a backend contract is missing, document the gap and propose a
compatible contract. Do not silently implement an incompatible
alternative.

## 4. Architecture

Use feature-based architecture with clear separation of
responsibilities.

Suggested structure:

``` text
SyncD-iOS/
├── SyncD.xcodeproj/
├── SyncD/
│   ├── App/
│   │   ├── SyncDApp.swift
│   │   ├── AppCoordinator.swift
│   │   └── AppDependencies.swift
│   ├── Core/
│   │   ├── Authentication/
│   │   ├── Networking/
│   │   ├── Persistence/
│   │   ├── Models/
│   │   ├── DesignSystem/
│   │   ├── Errors/
│   │   └── Utilities/
│   ├── Features/
│   │   ├── Authentication/
│   │   ├── Home/
│   │   ├── Rooms/
│   │   ├── Player/
│   │   ├── Queue/
│   │   ├── Search/
│   │   ├── Chat/
│   │   ├── Profile/
│   │   └── Settings/
│   ├── Playback/
│   │   ├── Engine/
│   │   ├── Session/
│   │   ├── RemoteCommands/
│   │   ├── Coordinator/
│   │   ├── Synchronization/
│   │   ├── Streaming/
│   │   └── Models/
│   └── Resources/
├── SyncDTests/
├── SyncDUITests/
├── Config/
├── Documentation/
├── README.md
└── PRD.md
```

Adjust the structure when the existing repository requires it, but
preserve architectural boundaries.

### Responsibilities

**AVPlayer / Audio Engine** - Owns actual audio playback. - Supports
authorized remote audio streams and local audio files. - Handles play,
pause, seek, buffering, playback errors, and item transitions. - Exposes
playback state through a stable interface. - Does not contain room
business logic.

**Playback Coordinator** - Owns synchronized listening logic. -
Interprets authoritative room playback state. - Calculates expected
playback position. - Applies corrections when the local player drifts. -
Handles room changes, host changes, reconnects, and stale playback
events. - Does not directly own SwiftUI presentation state.

**Audio Session Manager** - Configures AVAudioSession. - Handles audio
interruptions and route changes. - Supports background playback. -
Handles headphone disconnection and audio becoming unavailable.

**Now Playing Manager** - Publishes track metadata and playback status
to iOS. - Updates elapsed playback time and duration. - Configures
lock-screen and Control Center controls.

**Remote Command Manager** - Registers play, pause, toggle, next,
previous, and seek commands where supported. - Routes commands through
the same playback and room-permission rules as in-app controls. -
Removes or updates command handlers correctly when playback ends or
changes.

**Socket Manager** - Manages authenticated Socket.IO connections. -
Handles reconnection, room subscription, event validation, and
lifecycle. - Does not become a dependency for the audio engine to
continue playing.

## 5. Native playback requirements

Implement an audio engine abstraction, for example:

``` swift
protocol AudioEngine {
    var playbackState: PlaybackState { get }

    func load(_ item: PlaybackItem) async throws
    func play() async throws
    func pause() async
    func seek(to position: TimeInterval) async throws
    func setVolume(_ volume: Float)
    func stop() async
}
```

The final design may use AsyncStream, actors, or another appropriate
concurrency model. Avoid unsafe shared mutable state.

Required functionality: - Stream authorized remote audio. - Play
supported local audio files. - Maintain playback when the app enters the
background. - Display lock-screen metadata and controls. - Support
Control Center and supported external media controls. - Handle
interruptions, route changes, buffering, and playback failures. -
Release observers and player resources correctly. - Avoid retaining
unnecessary audio resources. - Keep UI state consistent with actual
AVPlayer state.

Configure the appropriate background audio capability in the Xcode
project and configure AVAudioSession using the correct playback category
and mode.

Do not promise unrestricted background execution. The implementation
must respect iOS lifecycle and audio-session policies.

### Source restrictions

YouTube content must remain within applicable YouTube player and API
policies.

Do not extract YouTube audio, feed it into AVPlayer, hide video to
provide background audio, or claim background playback support for
YouTube content when platform policies prohibit it.

Represent source capabilities explicitly so the UI can explain when
background playback is unavailable.

## 6. Background playback and mini-player

Implement two distinct experiences.

### In-app mini-player

-   Persistent mini-player while navigating the app.
-   Displays artwork, title, artist, and playback state.
-   Play/pause control.
-   Tap to expand the full player.
-   Remains consistent across tabs and room screens.
-   Supports loading, buffering, failed, and empty states.
-   Does not disappear simply because the user navigates to another
    screen.

### iOS system media experience

-   Lock-screen artwork and metadata.
-   Track title and artist.
-   Playback duration and elapsed position when available.
-   Play/pause remote commands.
-   Seek support when applicable.
-   Control Center integration.
-   Correct state updates after interruptions, route changes, and item
    changes.

Never implement a fake lock-screen player using a custom notification.

## 7. Synchronization requirements

The server is authoritative for shared-room playback.

Use the existing SyncD playback protocol whenever available.

A playback snapshot should conceptually contain: - Track identifier. -
Playback status. - Playback position. - Server timestamp. - Playback
rate. - Host/controller identifier. - Room identifier. - Revision or
sequence identifier if supported.

Expected playback position:

`P(t) = P₀ + (T_server - T₀) × playbackRate`

Use the actual backend timestamp and clock synchronization contract. Do
not assume the device wall clock is perfectly synchronized.

Initial drift thresholds for testing: - Under 250 ms: no correction. -
250--750 ms: monitor. - 750 ms--2 seconds: consider gradual correction
if supported. - Above 2 seconds: perform an authoritative seek when
appropriate.

These are initial engineering thresholds, not guaranteed perceptual
tolerances. Measure actual device behaviour and tune them.

Requirements: - Reject stale or out-of-order playback updates. - Avoid
feedback loops where local player updates are mistaken for user
commands. - Respect host and participant permissions. - Reconcile
playback after reconnecting. - Handle host changes. - Handle room
changes and track transitions. - Do not rely on Socket.IO remaining
connected while the app is backgrounded. - Keep currently authorized
playback alive during a temporary network disconnection where source and
session availability permit.

## 8. Host-PC streaming

The iOS application should: - Consume authenticated stream URLs supplied
by the backend or host connection flow. - Support seeking when the
source supports HTTP Range requests. - Handle expired stream
credentials. - Handle unavailable hosts and disconnected streams. -
Avoid exposing raw filesystem paths. - Never bypass access controls or
stream media without authorization. - Distinguish local playback,
remote-host playback, and unsupported source types.

Do not implement custom peer-to-peer or NAT traversal unless the
existing project explicitly requires it. Document relay or connectivity
requirements.

## 9. Authentication and networking

Integrate with existing Clerk authentication and backend authentication
flow.

Requirements: - Secure credential storage in Keychain. - Correct session
restoration. - Authenticated API requests. - Authenticated Socket.IO
connection. - Token refresh according to the existing authentication
contract. - Consistent handling of unauthorized, forbidden, offline,
timeout, and server errors. - No hardcoded production secrets. -
Environment-specific API configuration.

Use URLSession and a reusable networking layer. Do not scatter endpoint
calls throughout SwiftUI views.

## 10. UI/UX requirements

Create a polished, native iOS interface.

Design direction: - Dark-first visual identity. - Music-focused
presentation. - Premium, clean, modern appearance. - Clear hierarchy and
readable typography. - Native navigation and interaction conventions. -
Smooth, restrained animations. - Consistent artwork and album
presentation. - Native safe-area handling. - Dynamic Type and
accessibility support. - Light appearance should remain functional
unless the product explicitly disables it.

Every interactive screen and UI element must account for applicable
states: - Initial/loading. - Success/content. - Empty. - Error. -
Offline. - Disabled or permission-restricted. - Buffering, where
relevant. - Retry or recovery, where possible.

Do not use fake data in production flows. Clearly isolate previews and
mock data from real application services.

### Main screens

1.  Authentication.
2.  Home and room discovery.
3.  Room details and participant list.
4.  Full-screen player.
5.  Persistent mini-player.
6.  Shared queue.
7.  Music search.
8.  Room chat.
9.  User profile.
10. Settings.

## 11. Error handling and observability

Create typed, actionable errors.

Handle: - Network failures. - Authentication expiration. - Socket
disconnections. - Invalid playback sources. - AVPlayer item failures. -
Buffering timeouts. - Audio-session interruptions. - Missing media
metadata. - Unauthorized room commands. - Host-PC unavailability. -
Unsupported background playback sources.

Log useful diagnostics without logging access tokens, private user data,
or sensitive stream URLs.

## 12. Testing requirements

Create unit tests for: - Playback coordinator. - Playback position
calculations. - Drift correction. - Permission handling. - Playback
state transitions. - API decoding. - Error mapping. - Reconnection and
stale-event handling.

Create integration/UI tests for: - Login and session restoration. -
Joining a room. - Starting playback. - Pausing and seeking. - Queue
updates. - Room synchronization. - Mini-player navigation. -
Backgrounding and foregrounding. - Lock-screen commands. - Interruption
recovery. - Network disconnection and reconnection.

Test on physical iPhones. Simulator testing alone is insufficient for
validating real background audio, Bluetooth routing, interruptions, and
lock-screen behaviour.

## 13. Implementation rules

-   Build in small, reviewable increments.
-   Compile after each major architectural stage.
-   Do not create giant SwiftUI views.
-   Keep business logic outside views.
-   Use dependency injection.
-   Avoid unnecessary singletons.
-   Avoid force unwraps in production code.
-   Avoid placeholder implementations presented as completed features.
-   Never swallow errors silently.
-   Never fabricate backend API contracts.
-   Do not break the existing web or Android implementation.
-   Document assumptions and unresolved integration points.

## 14. Required deliverables

Produce: 1. Working native iOS Xcode project. 2. Complete feature-based
source structure. 3. Native AVPlayer playback engine. 4. Background
playback lifecycle implementation. 5. Lock-screen and Control Center
integration. 6. Persistent in-app mini-player. 7. Playback
synchronization coordinator. 8. Backend API and Socket.IO integration.
9. Authentication integration. 10. Unit and integration tests. 11.
README.md. 12. PRD.md. 13. Environment configuration example without
secrets. 14. Architecture and protocol documentation. 15. Known
limitations and implementation status.

## 15. Definition of done

The application is not complete merely because it builds or displays
screens.

The initial working prototype must demonstrate: - A user can
authenticate. - A user can join a real SyncD room. - A user can load an
authorized audio source. - Audio plays through AVPlayer. - The
mini-player remains available while navigating. - Eligible audio
continues when the app is backgrounded. - Lock-screen and Control Center
controls work. - Multiple room participants receive synchronized
playback updates. - Reconnection reconciles the player with
authoritative room state. - Errors and empty states are visible and
recoverable. - The project builds and tests successfully.

Start by inspecting the repository and writing the implementation plan.
Then implement the foundation before building the full feature set.

Do not claim a feature is complete until it has been implemented and
tested.
