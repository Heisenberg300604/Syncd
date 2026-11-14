# SyncD iOS --- Product Requirements Document

**Product:** SyncD\
**Platform:** iOS\
**Document Version:** 1.0\
**Status:** Initial Product Specification\
**Minimum iOS Version:** iOS 17\
**Primary Objective:** Deliver a native iOS application for synchronized
social music listening.

------------------------------------------------------------------------

# 1. Product Overview

## 1.1 What is SyncD?

SyncD is a real-time social listening platform that allows people to
listen to music together regardless of their physical location.

Users can create listening rooms, invite friends, join public rooms,
share queues, chat, and control synchronized playback.

SyncD is not simply a music player. It combines a native music playback
experience with real-time social interaction.

The iOS application is a standalone native implementation that shares
the existing SyncD backend and playback protocol with the web and
Android applications.

## 1.2 Product Vision

Make listening to music with friends feel as natural as listening
together in the same room.

The experience should be: - Social. - Synchronized. - Responsive. -
Reliable. - Music-focused. - Native to iOS.

## 1.3 Core Product Principles

1.  Native iOS experience rather than a web application inside a
    wrapper.
2.  Reliable background audio for eligible sources.
3.  Persistent mini-player across application navigation.
4.  Server-authoritative synchronized listening.
5.  Consistent experience across iOS, Android, and Web.
6.  Clear room permissions and playback ownership.
7.  Graceful handling of unreliable networks and unavailable sources.

# 2. Target Users

## 2.1 Casual Listeners

People who want to listen to music with friends without managing
complicated playback controls.

## 2.2 Music Enthusiasts

Users who want to discover tracks, share playlists, and participate in
music-focused communities.

## 2.3 Room Hosts

Users who create listening rooms and control shared playback.

## 2.4 Room Participants

Users who join rooms and participate in shared listening sessions.

# 3. Scope

## 3.1 MVP Scope

The first functional iOS prototype must support: - Authentication. -
User profiles. - Home screen. - Room discovery. - Creating rooms. -
Joining rooms. - Participant lists. - Native audio playback. -
Background playback for eligible sources. - Lock-screen controls. -
Control Center integration. - Persistent mini-player. - Full-screen
player. - Shared queue. - Real-time playback synchronization. - Basic
room chat. - Reconnection and playback recovery. - Error, loading,
empty, and success states.

## 3.2 Post-MVP Scope

The following can be introduced after the initial prototype: - Advanced
recommendations. - Advanced room discovery filters. - Detailed listening
history. - Rich social profiles. - Friend management. - Advanced
playlist management. - Push notification workflows. - Advanced offline
support. - Audio quality preferences. - Advanced host-PC connection and
relay management.

Do not delay the working playback prototype to implement these features.

# 4. Application Navigation

The application should use native iOS navigation patterns.

## 4.1 Main Navigation

Suggested primary navigation: 1. Home 2. Discover 3. Activity or Chat 4.
Profile

A persistent mini-player should appear above the main navigation when
there is an active or resumable playback session.

The exact tab layout can be refined during design implementation.

## 4.2 Navigation Requirements

-   Navigation must preserve relevant screen state.
-   Opening the full player must not create a second player instance.
-   Switching tabs must not stop playback.
-   Returning to a room must restore its current state.
-   Navigation must work with supported iOS accessibility features.
-   Sheet presentation and dismissal must follow native iOS conventions.

# 5. Authentication

## 5.1 Requirements

Users must be able to authenticate through the existing SyncD
authentication infrastructure.

Required functionality: - Sign in. - Sign up, if supported by the
existing authentication configuration. - Session restoration. - Sign
out. - Authentication error handling. - Secure token storage.

## 5.2 Acceptance Criteria

-   A valid user can authenticate.
-   An invalid login displays an actionable error.
-   An expired session follows the existing authentication refresh flow.
-   Restarting the application restores a valid session.
-   Credentials and sensitive tokens are never stored in plain text.

# 6. Home Screen

## 6.1 Purpose

Provide an entry point into SyncD's listening experience.

## 6.2 Features

-   Welcome section.
-   User information.
-   Recommended or featured rooms, if supported by the backend.
-   Recently joined rooms, if available.
-   Active listening sessions.
-   Quick room creation.
-   Navigation to discovery.
-   Mini-player when playback is active.

## 6.3 States

**Loading:** Display a native loading treatment.

**Success:** Display available home content.

**Empty:** Explain that no rooms or recent activity are available.

**Error:** Display an actionable error and retry option.

**Offline:** Display cached information where available and explain
unavailable actions.

## 6.4 Acceptance Criteria

-   The home screen loads data from the real backend.
-   Navigation to rooms works.
-   Room cards reflect actual room state.
-   Loading and error states are implemented.
-   The mini-player remains consistent with the active playback session.

# 7. Room Discovery

## 7.1 Purpose

Allow users to find rooms they want to join.

## 7.2 Features

-   List available rooms.
-   Room name.
-   Room host.
-   Participant count.
-   Public/private visibility.
-   Current track information where available.
-   Room status.
-   Join action.

## 7.3 Acceptance Criteria

-   Only rooms available to the user are displayed.
-   Private room access follows backend authorization.
-   Joining an unavailable room displays a clear error.
-   Room lists refresh correctly.
-   Empty discovery results have a dedicated empty state.

# 8. Listening Rooms

## 8.1 Purpose

A listening room is the central social experience of SyncD. Users share
a playback session and interact with other participants.

## 8.2 Room Information

Display: - Room name. - Host information. - Participant list. - Current
track. - Playback status. - Queue. - Chat. - Room controls.

## 8.3 Room Roles

### Host

The host can control room-level playback according to the existing
backend permission model.

Potential capabilities: - Play. - Pause. - Seek. - Skip. - Manage
queue. - Remove participants, if supported. - Update room settings, if
supported.

### Participant

Participants can: - View playback state. - Listen to the current
track. - View the queue. - Chat. - Submit queue additions when
permitted.

All permissions must come from the existing backend. Do not hardcode a
different role system in iOS.

## 8.4 Room Lifecycle

1.  User creates or joins a room.
2.  Application obtains room information.
3.  Application subscribes to room events.
4.  Application receives authoritative playback state.
5.  Player loads an eligible source.
6.  Playback is synchronized.
7.  Room updates are reflected in the UI.
8.  User leaves or disconnects.
9.  Room resources and subscriptions are cleaned up appropriately.

## 8.5 Acceptance Criteria

-   Users can join authorized rooms.
-   Room state updates in real time.
-   Participants appear and disappear according to presence events.
-   Host controls are enforced.
-   Leaving a room does not accidentally create duplicate subscriptions.
-   Rejoining restores the latest authoritative state.

# 9. Native Music Player

## 9.1 Purpose

Provide reliable, native audio playback on iOS.

## 9.2 Technology

-   AVPlayer.
-   AVPlayerItem.
-   AVAudioSession.
-   MPNowPlayingInfoCenter.
-   MPRemoteCommandCenter.

The actual implementation must encapsulate these frameworks behind a
dedicated playback engine.

## 9.3 Playback Controls

Required controls: - Play. - Pause. - Seek. - Next track. - Previous
track, where applicable. - Volume, where supported by the product's
playback model.

## 9.4 Track Information

Display: - Track title. - Artist. - Artwork. - Duration. - Elapsed
position. - Playback status. - Source information where relevant.

Missing metadata must not crash or break the player.

## 9.5 Playback States

The player must represent: - Idle. - Loading. - Ready. - Playing. -
Paused. - Buffering. - Seeking. - Ended. - Failed.

The UI must reflect the real player state, not simply the last button
pressed.

## 9.6 Acceptance Criteria

-   An authorized audio source can be loaded.
-   Playback starts and pauses correctly.
-   Seeking updates the actual player position.
-   Buffering is visible.
-   Invalid sources display an actionable error.
-   Track transitions update metadata.
-   Playback state remains consistent across navigation.

# 10. Background Playback

## 10.1 Priority

**High priority --- MVP requirement**

Background playback is a fundamental requirement for SyncD iOS.

## 10.2 Requirements

For eligible audio sources: - Playback continues when the application
enters the background. - Playback continues when the device is locked. -
Audio session is configured appropriately. - Player resources remain
valid. - Track metadata is available to the system. - Playback can be
controlled from the lock screen. - Playback can be controlled from
Control Center. - Playback recovers correctly after supported
interruptions.

## 10.3 Audio Interruptions

Handle: - Incoming phone calls. - Siri interactions. - Other
applications taking audio focus. - Headphone disconnection. - Bluetooth
route changes. - Audio session interruption notifications.

The application must distinguish between a temporary interruption and an
intentional pause.

## 10.4 Acceptance Criteria

-   Eligible audio continues after the user backgrounds SyncD.
-   Lock-screen metadata is correct.
-   Lock-screen play/pause controls work.
-   Control Center controls work.
-   Playback resumes or remains paused according to interruption policy.
-   Returning to the application restores accurate playback state.

## 10.5 Source Restrictions

Not all media sources support background playback.

YouTube playback must follow YouTube's applicable player and API
policies. SyncD must not extract audio or provide prohibited background
audio playback.

The UI must identify unsupported background playback sources and explain
the limitation.

# 11. Mini-player

## 11.1 Priority

**High priority --- MVP requirement**

## 11.2 Purpose

Allow users to control playback while navigating the rest of SyncD.

## 11.3 UI Elements

-   Track artwork.
-   Track title.
-   Artist.
-   Play/pause button.
-   Playback progress indicator.
-   Expand-player interaction.

## 11.4 Behaviour

-   Appears when an eligible playback session exists.
-   Remains visible across supported application navigation.
-   Expands into the full player.
-   Reflects buffering and errors.
-   Does not create another AVPlayer instance.
-   Updates when room playback changes.
-   Disappears or changes appropriately when playback is stopped or the
    session is removed.

## 11.5 Acceptance Criteria

-   The mini-player persists across tabs.
-   Play/pause controls affect the actual audio engine.
-   Expanding opens the correct active player.
-   Track changes update artwork and metadata.
-   Buffering and failure states are represented.

# 12. Full-screen Player

## 12.1 Purpose

Provide a dedicated music-listening interface.

## 12.2 UI Elements

-   Large artwork.
-   Track title.
-   Artist.
-   Progress slider.
-   Elapsed and remaining time.
-   Play/pause.
-   Previous/next.
-   Queue access.
-   Room information.
-   Host/participant role indicator.

## 12.3 Behaviour

-   Displays the currently active room's track.
-   Reflects actual playback state.
-   Uses room permissions for controls.
-   Supports seeking when allowed.
-   Provides visual feedback during buffering.
-   Does not stop playback when dismissed.

# 13. Shared Queue

## 13.1 Purpose

Allow room participants to contribute to a shared listening sequence.

## 13.2 Features

-   Current track.
-   Upcoming tracks.
-   Track artwork.
-   Track title and artist.
-   Queue ordering.
-   Add track.
-   Remove track where authorized.
-   Skip track where authorized.
-   Real-time queue updates.

## 13.3 Rules

-   The backend remains authoritative for queue state.
-   Queue changes must be validated by the backend.
-   Duplicate handling follows existing product rules.
-   Unauthorized changes must be rejected visibly.
-   Concurrent queue modifications must not silently overwrite newer
    state.

## 13.4 Acceptance Criteria

-   Queue loads from the backend.
-   Queue updates appear in real time.
-   Permissions are respected.
-   Empty queues have a dedicated state.
-   Failed queue operations can be retried.

# 14. Music Search

## 14.1 Purpose

Allow users to find tracks that can be added to a room queue or played
through supported sources.

## 14.2 Features

-   Search input.
-   Search results.
-   Track artwork.
-   Track title.
-   Artist.
-   Source information.
-   Add-to-queue action.

## 14.3 Acceptance Criteria

-   Search uses existing backend and provider integration.
-   Loading and empty states are implemented.
-   Search failures are recoverable.
-   Unsupported media sources are identified.
-   Queue actions respect room permissions.

# 15. Chat and Social Interaction

## 15.1 Room Chat

Required MVP capabilities: - View messages. - Send messages. - Display
sender identity. - Display message timestamps. - Receive messages in
real time. - Handle failed message delivery.

## 15.2 Participant Presence

-   Display current participants.
-   Display host status.
-   Update presence in real time.
-   Handle disconnects and reconnects.
-   Avoid duplicate participants.

## 15.3 Acceptance Criteria

-   Messages appear in the correct room.
-   Sending failures are visible.
-   Presence changes are reflected.
-   Room-specific data is isolated between rooms.

# 16. Host-PC Streaming

## 16.1 Purpose

Allow authorized audio to be streamed from a host PC when the audio is
not available locally on the iPhone.

## 16.2 Requirements

-   Receive an authorized stream endpoint.
-   Authenticate stream access.
-   Support seeking when HTTP Range requests are supported.
-   Handle unavailable hosts.
-   Handle expired credentials.
-   Handle interrupted connections.
-   Display source and connection status.

## 16.3 Security Requirements

-   Never expose raw filesystem paths.
-   Never bypass host authorization.
-   Do not store long-lived stream credentials in plain text.
-   Do not assume every host is directly reachable.
-   Use an authorized relay when the connection architecture requires
    it.

## 16.4 Acceptance Criteria

-   An authorized host stream can be played.
-   Seeking works when the source supports it.
-   An unavailable host produces a clear error.
-   Reconnection does not silently start the wrong track.
-   Stream access is validated by the existing authorization system.

# 17. Playback Synchronization

## 17.1 Priority

**Core MVP requirement**

## 17.2 Purpose

Keep all eligible room participants at approximately the same playback
position.

## 17.3 Source of Truth

The SyncD backend is authoritative for shared-room playback state.

The local AVPlayer reports its actual playback state, but does not
independently redefine the shared room state.

## 17.4 Synchronization Model

A playback snapshot should conceptually contain: - Room ID. - Track
ID. - Playback status. - Position. - Server timestamp. - Playback
rate. - Host/controller ID. - Revision or sequence number, if supported.

Expected position:

`expectedPosition = initialPosition + elapsedServerTime × playbackRate`

Use the existing server-time and clock-offset contract.

## 17.5 Drift Correction

Initial test thresholds:

  Drift               Behaviour
  ------------------- -----------------------------
  Under 250 ms        No correction
  250--750 ms         Monitor
  750 ms--2 seconds   Consider gradual correction
  Above 2 seconds     Consider authoritative seek

These are starting thresholds and must be validated with actual devices,
audio sources, and network conditions.

## 17.6 Reconnection

When Socket.IO disconnects: - Do not automatically destroy active
playback. - Continue eligible playback where possible. - Show an
appropriate connection state. - Reconnect using the existing protocol. -
Fetch or receive authoritative playback state. - Reconcile track and
position. - Reject stale events.

## 17.7 Acceptance Criteria

-   Multiple participants receive the same playback state.
-   Host commands propagate.
-   Unauthorized commands are rejected.
-   Drift correction is applied appropriately.
-   Reconnection restores the correct track and position.
-   Stale events cannot overwrite newer state.

# 18. Authentication, Networking and Data

## 18.1 Authentication

Integrate with existing Clerk authentication and backend contracts.

## 18.2 Networking

Use URLSession for HTTP APIs and Socket.IO Client Swift for real-time
events.

## 18.3 Persistence

Use SwiftData for appropriate local application data.

Potential persisted data: - User preferences. - Cached room
information. - Recently accessed rooms. - Non-sensitive playback
metadata. - UI preferences.

Use Keychain for sensitive authentication credentials.

Do not treat local persistence as the authoritative source of shared
room playback.

# 19. Design and UX Requirements

## 19.1 Visual Direction

SyncD should feel like a premium, music-first iOS application.

Design characteristics: - Dark-first interface. - Strong artwork
presentation. - Clean layouts. - Clear typography. - Refined spacing. -
Subtle animations. - Smooth player transitions. - Consistent visual
language. - Native iOS interaction patterns.

## 19.2 Design References

Use these as inspiration rather than templates: - Apple Music for native
iOS music interactions. - Spotify for music discovery and player
hierarchy. - Discord for social room and participant interaction. -
Existing SyncD web design for product identity and visual consistency.

Do not copy another application's interface.

## 19.3 Component States

Every applicable interactive component must support:

  State       Expected behaviour
  ----------- ----------------------------------------------
  Default     Normal interactive state
  Loading     Clear loading feedback
  Success     Reflect successful operation
  Empty       Explain missing content
  Error       Explain failure and recovery
  Disabled    Explain unavailable action where appropriate
  Offline     Communicate connectivity limitations
  Buffering   Show playback loading state

## 19.4 Accessibility

-   Dynamic Type.
-   VoiceOver labels.
-   Accessible control names.
-   Adequate contrast.
-   Appropriate touch targets.
-   Reduced-motion support.
-   Clear status announcements where appropriate.

# 20. Non-functional Requirements

## 20.1 Performance

-   Avoid unnecessary UI redraws.
-   Avoid excessive polling.
-   Use efficient artwork loading and caching.
-   Avoid blocking the main thread.
-   Manage AVPlayer observers correctly.
-   Avoid unnecessary player recreation.

## 20.2 Reliability

-   Handle temporary network failures.
-   Handle socket reconnection.
-   Recover from audio interruptions.
-   Handle invalid and expired media sources.
-   Prevent duplicate playback sessions.
-   Clean up resources when leaving rooms.

## 20.3 Security

-   Use secure credential storage.
-   Avoid hardcoded secrets.
-   Validate incoming API and socket payloads.
-   Respect backend authorization.
-   Avoid sensitive data in logs.
-   Use secure transport in production.

## 20.4 Maintainability

-   Feature-based project structure.
-   Reusable design components.
-   Testable services.
-   Clear domain models.
-   Typed errors.
-   Documented backend contracts.

# 21. Analytics and Diagnostics

The initial prototype should capture useful technical diagnostics
without collecting unnecessary personal data.

Potential events: - Playback started. - Playback paused. - Playback
failed. - Room joined. - Room left. - Socket disconnected. - Socket
reconnected. - Playback drift detected. - Playback reconciled. - Audio
interruption occurred. - Host stream unavailable.

Diagnostics must not include credentials, private stream tokens, or
sensitive user content.

Analytics infrastructure should only be added if it fits the existing
SyncD backend and privacy model.

# 22. Testing and Quality Assurance

## 22.1 Unit Tests

Test: - Playback position calculations. - Drift correction. - Playback
state transitions. - Permission evaluation. - Queue state handling. -
API response decoding. - Error mapping. - Stale-event handling. -
Reconnection reconciliation.

## 22.2 Integration Tests

Test: - Authentication. - Room joining. - Socket event handling. - Audio
source loading. - AVPlayer state changes. - Remote commands. - Queue
updates. - Playback synchronization.

## 22.3 Physical Device Tests

Mandatory validation: - Background audio. - Device locking. -
Lock-screen controls. - Control Center controls. - Bluetooth
headphones. - Wired headphones where supported. - Incoming calls. - Siri
interruption. - Network disconnection. - Network reconnection. -
Long-running playback. - App termination and relaunch behaviour.

Simulator success does not establish production background playback
reliability.

# 23. MVP Acceptance Checklist

The first working prototype is accepted when the following requirements
are demonstrably functional.

### Foundation

-   [ ] Native SwiftUI application.
-   [ ] Correct project architecture.
-   [ ] Environment configuration.
-   [ ] Existing authentication integration.
-   [ ] Backend connectivity.

### Playback

-   [ ] AVPlayer audio engine.
-   [ ] Local audio playback.
-   [ ] Authorized remote streaming.
-   [ ] Play/pause.
-   [ ] Seek.
-   [ ] Buffering states.
-   [ ] Playback error recovery.

### Background Experience

-   [ ] Background audio capability.
-   [ ] Audio session configuration.
-   [ ] Lock-screen metadata.
-   [ ] Lock-screen controls.
-   [ ] Control Center integration.
-   [ ] Interruption handling.
-   [ ] Route-change handling.

### UI

-   [ ] Home.
-   [ ] Room discovery.
-   [ ] Room screen.
-   [ ] Mini-player.
-   [ ] Full-screen player.
-   [ ] Shared queue.
-   [ ] Chat.
-   [ ] Loading, success, empty, and error states.

### Synchronization

-   [ ] Socket.IO integration.
-   [ ] Room playback state.
-   [ ] Host controls.
-   [ ] Participant permissions.
-   [ ] Drift correction.
-   [ ] Reconnection recovery.

### Quality

-   [ ] Unit tests.
-   [ ] Integration tests.
-   [ ] Physical-device background playback validation.
-   [ ] No hardcoded production secrets.
-   [ ] README updated.
-   [ ] Known limitations documented.

# 24. Suggested Development Milestones

## Milestone 1 --- Native Foundation

-   Xcode project.
-   Architecture.
-   Design system.
-   Networking.
-   Authentication.

## Milestone 2 --- Playback Engine

-   AVPlayer.
-   Audio session.
-   Background capability.
-   Now Playing metadata.
-   Remote commands.

## Milestone 3 --- Player Experience

-   Mini-player.
-   Full-screen player.
-   Track metadata.
-   Queue UI.

## Milestone 4 --- Real-time Listening

-   Room discovery.
-   Room joining.
-   Socket.IO.
-   Playback synchronization.
-   Drift correction.

## Milestone 5 --- Social Features

-   Participants.
-   Chat.
-   Profiles.
-   Search.

## Milestone 6 --- Reliability and Release Preparation

-   Reconnection.
-   Audio interruption recovery.
-   Host-PC streaming.
-   Accessibility.
-   Physical-device testing.
-   Performance and security review.

# 25. Product Success Criteria

The MVP is successful when: 1. Users can authenticate and join a real
listening room. 2. Authorized audio plays through native AVPlayer. 3.
Eligible audio continues playing in the background. 4. Lock-screen and
Control Center controls function correctly. 5. The in-app mini-player
persists across navigation. 6. Participants receive synchronized
playback updates. 7. Reconnection restores the correct room playback
state. 8. The application handles errors without silently failing. 9.
The iOS application remains compatible with the existing SyncD backend
and Android playback protocol.

**Final product principle:** SyncD iOS must be a real native
music-listening application, not merely a collection of screens
connected to a backend. Playback reliability, room synchronization, and
the quality of the listening experience are the product's foundation.
