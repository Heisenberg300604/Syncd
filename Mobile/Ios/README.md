# SyncD iOS

A native iOS app for SyncD: listen to music with friends in shared rooms, with synchronized playback.

It uses the existing SyncD backend (`../server`) for REST, Socket.IO, authentication and authorization, and Clerk for sign-in. It does not share any UI code with the web client (`../client`).

> **Status: Milestone 1 (foundation) and the playback engine are done. Room audio is not yet audible on iOS.**
> The backend's only media source is YouTube, and the PRD forbids feeding YouTube audio into AVPlayer. On iOS, rooms therefore play no sound for now: the app follows the room's timeline in silence. See [Known limitations](#known-limitations) and [Documentation/BACKEND_CONTRACT.md §4.1](Documentation/BACKEND_CONTRACT.md#41-native-playable-sources-blocking-background-room-audio).

## Contents

- [Implementation status](#implementation-status)
- [Requirements](#requirements)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Playback and synchronization](#playback-and-synchronization)
- [Testing](#testing)
- [Known limitations](#known-limitations)
- [Documentation](#documentation)

## Implementation status

"Built" means implemented and covered by unit tests. Nothing on this list has been validated on a physical device yet.

| Area | Status |
| --- | --- |
| Xcode project, SPM, xcconfig environments | ✅ Built; app launches on the simulator |
| Clerk sign-in/up (prebuilt `AuthView`), session restore, sign-out | ✅ Built. Launch tested; full sign-in not yet run end to end |
| Onboarding (username), `/me` caching that matches the web rules | ✅ Built + tested |
| REST client (typed errors, single retry on 401 with a fresh token) | ✅ Built + tested |
| Socket.IO client (fresh token on every reconnect, backoff, network-return reconnect) | ✅ Built. Not yet run against a live server |
| Create / join by code / leave / stop listening | ✅ Built |
| Live presence, dynamic host, host-transfer banners, manual "Make host" | ✅ Built + tested |
| Shared queue (view; host remove/reorder/clear) | ✅ Built |
| Search and paste-a-link (host: play now / add to queue / playlists) | ✅ Built |
| Chat (live, merged history, failures shown with retry, 500-char limit) | ✅ Built + tested |
| Mini-player (persistent across tabs) and full-screen player | ✅ Built |
| AVPlayer engine, buffering/ended/failed states | ✅ Built. Exercised through "Playback lab" (local files) |
| Audio session, interruptions, route changes, media-services reset | ✅ Built + policy tested. **Needs device validation** |
| Lock screen / Control Center (Now Playing and remote commands) | ✅ Built. **Needs device validation** |
| Sync: server clock offset, expected position, drift correction, stale-event rejection, rejoin reconciliation | ✅ Built + tested |
| Room audio for YouTube tracks | ⛔ Blocked (policy). Rooms follow the timeline without sound |
| Host-PC streaming | ⛔ Blocked on a missing backend contract |
| Public room discovery | ⛔ Blocked on a missing backend contract. Join by code plus local recent rooms instead |
| UI tests, physical-device test pass | ❌ Not started |

## Requirements

- macOS with **Xcode 26+**. The Clerk iOS SDK requires Swift 6.2 tools.
- iOS 17.0+ deployment target.
- A running SyncD server (`cd ../server && npm run dev`).
- The Clerk instance's **Native API** must be enabled, with this bundle ID registered (Clerk Dashboard → Native applications).
- A physical iPhone, to validate background audio, the lock screen, Bluetooth and interruptions. The simulator can't establish these.

## Getting started

```sh
cd ios
cp Config/Local.example.xcconfig Config/Local.xcconfig   # then edit it
open SyncD.xcodeproj
```

Xcode resolves the Swift packages on first open:

- [`clerk-ios`](https://github.com/clerk/clerk-ios) 1.7.x (`ClerkKit`, `ClerkKitUI`)
- [`socket.io-client-swift`](https://github.com/socketio/socket.io-client-swift) 16.1.x. It speaks the Socket.IO v3/v4 protocol; the server runs socket.io 4.8.

To build and test from the command line on the booted simulator:

```sh
./build.sh build
./build.sh test
```

To run on a device, set `DEVELOPMENT_TEAM` (and, if needed, `SYNCD_BUNDLE_ID`) in `Config/Local.xcconfig`. Point `SYNCD_API_BASE_URL` at your Mac's LAN IP: `localhost` on the phone is the phone itself.

## Configuration

| Setting | Where | Notes |
| --- | --- | --- |
| `SYNCD_API_BASE_URL` | `Debug.xcconfig` default `http://localhost:5000/api`; override in `Local.xcconfig` | Same value as web `VITE_API_BASE_URL`. **In xcconfig files, `//` starts a comment.** Write `https:/$()/host/api`. |
| `SYNCD_CLERK_PUBLISHABLE_KEY` | `Local.xcconfig` | Same as web `VITE_CLERK_PUBLISHABLE_KEY`. The app refuses to start with an `sk_` key. |
| `SYNCD_ENVIRONMENT` | `Debug`/`Release.xcconfig` | `production` requires HTTPS. |
| `DEVELOPMENT_TEAM`, `SYNCD_BUNDLE_ID` | `Local.xcconfig` | Signing. |

`Config/Local.xcconfig` is gitignored. The app never contains a secret key. If configuration is missing or invalid, the app shows a configuration screen with instructions instead of crashing.

ATS: `NSAllowsLocalNetworking` permits `http://` to localhost and LAN hosts during development. Public hosts still require HTTPS.

## Architecture

Feature-based MVVM with service boundaries. The code uses the Swift 6 language mode with complete strict concurrency checking.

```
SyncD/
├── App/          SyncDApp (bootstrap), AppDependencies (composition root), RootView
├── Core/
│   ├── Authentication/  AuthProviding + ClerkAuthProvider, SessionStore
│   ├── Configuration/   AppConfiguration
│   ├── DesignSystem/    Theme (mirrors client/src/index.css tokens), components, state views
│   ├── Errors/          APIError, SocketError, PresentableError
│   ├── Models/          DTOs mirroring server/src/**/*.types.ts
│   ├── Networking/      APIClient, SyncDAPI
│   ├── Persistence/     SwiftData RecentRoom cache
│   ├── Realtime/        RoomRealtimeClient + SocketIORoomClient
│   └── Utilities/       JSON coding, durations, monotonic clock, logging
├── Features/     Authentication, Home, Rooms, Player, Queue, Search, Chat, Profile
└── Playback/
    ├── Engine/          AudioEngine protocol, AVPlayerAudioEngine
    ├── Session/         AudioSessionManager, InterruptionPolicy
    ├── NowPlaying/      MPNowPlayingInfoCenter
    ├── RemoteCommands/  MPRemoteCommandCenter
    ├── Synchronization/ ServerClock, RoomPlaybackState, SnapshotSequencer, DriftPolicy
    ├── Coordinator/     PlaybackCoordinator
    └── Models/          PlaybackSource (+ capabilities), PlaybackItem, EngineState
```

Ownership rules:

- **There is one `AVPlayer` for the app's lifetime.** It lives in `AVPlayerAudioEngine`, which `PlaybackCoordinator` owns, which `AppDependencies` owns. Views never own playback. The mini-player and the full player only read the coordinator.
- **There is one active room.** `RoomsController.active` holds the only `RoomSession`, and therefore the only socket. Leaving a screen doesn't unsubscribe. *Stop listening* closes the socket and keeps membership; *Leave room* calls `POST /rooms/:code/leave`.
- **A dropped socket doesn't stop audio.** The socket client has no reference to the engine.
- **All controls take one path.** In-app buttons, the lock screen, Control Center and headphone buttons call the same coordinator methods, so room permissions apply to every one of them. The server re-checks host status on every command regardless.
- **Clerk is isolated behind `AuthProviding`.** Clerk stores its session in the Keychain. SyncD never stores tokens itself.

## Playback and synchronization

The server is authoritative for room playback (`Room` row; see `docs/ARCHITECTURE.md` §4).

- **Expected position:** `P(t) = position + (serverNow − updatedAt) × 1` while playing, clamped to the track length.
- **Server time** is estimated from the `serverTime` field on each snapshot. Each ack gives a lower and an upper bound on the clock offset (`[s − receivedAt, s − sentAt]`); each broadcast gives a lower bound. The device wall clock is never trusted, and elapsed time uses a monotonic clock.
- **Stale events:** snapshots are ordered by `updatedAt`, which the server rewrites on every mutation. Older snapshots are dropped. Join/rejoin snapshots re-apply at an equal `updatedAt`, which forces a re-seek after reconnecting.
- **Drift** is checked every 2 s, with a 3 s cooldown after any seek. These are the PRD's starting thresholds and still need tuning on real devices:

  | Drift | Action |
  | --- | --- |
  | < 250 ms | none |
  | 250–750 ms | monitor |
  | 750 ms – 2 s | rate ±≤5% |
  | > 2 s | seek |

- **Echo suppression:** the app emits `playback:control` only for explicit user intents, never for engine state changes.
- **Roles:**
  - The host's play, pause and seek controls drive the room.
  - A participant's pause is local ("Paused on this iPhone"). Resuming rejoins the live position.
  - Unplugging headphones or an interruption never pauses the room, even for the host.
- **Auto-advance:** only the host emits `queue:advance { expectedFrontVideoId }`. It fires when the engine ends, or from the timeline when there's no local audio. The guard makes duplicate advances harmless.
- **Interruptions:** iOS's `shouldResume` hint is respected, but a user pause during the interruption wins over it. In a room, resuming re-seeks to the room's current position rather than resuming where the audio stopped.
- **Backgrounding:** native audio continues; the socket may be suspended. On returning to the foreground, the app reconnects immediately and re-aligns with the room.

## Testing

```sh
./build.sh test
```

110 Swift Testing tests (127 cases including parameterized arguments) cover:

- expected-position math, drift policy, stale/duplicate/resync ordering, and server-clock bounds
- interruption policy
- `PlaybackCoordinator` with a mock engine: join seek, local participant pause, host commands and acks, rejected commands, drift seek and rate correction, timeline/engine auto-advance, interruptions, route loss, load failure
- `RoomSession`: presence and dynamic host, host handover, chat merge on reconnect, the queue-advance guard
- `SessionStore` routing rules
- decoding of server-shaped payloads, API error mapping (400–503, 429 `Retry-After`, offline, timeout), 401 retry with a fresh token
- configuration validation and server-mirrored validation rules

Still to do: UI tests, integration tests against a running server, and the [physical-device checklist](Documentation/DEVICE_TEST_PLAN.md).

## Known limitations

1. **No audio for room tracks on iOS (YouTube).** iOS follows the room's timeline, shows the track, and lets the host control playback for everyone, but plays no sound. Fixing this needs a product decision (an official YouTube embed, which is foreground-only, and/or the host-stream contract). See [IMPLEMENTATION_PLAN.md §5](Documentation/IMPLEMENTATION_PLAN.md).
2. **Background audio, the lock screen and Control Center** are implemented, but today only local files in **Profile → Playback lab** use them. They have not yet been validated on a device.
3. **Host-PC streaming** needs a backend contract that doesn't exist yet.
4. **No public room discovery.** Rooms are joined by code; "Recent rooms" is a per-account local cache.
5. **Queue edits are host-only on the server**, so participants see a read-only queue and can't search.
6. **Queue operations are index-based** in the protocol. A concurrent change between a tap and the server receiving it could target a different item. Local mutations are serialized to reduce this.
7. **No revision numbers.** Ordering relies on `updatedAt` at millisecond resolution.
8. **Native Clerk tokens and socket `authorizedParties`:** the server pins socket tokens to browser origins (`azp`). Native tokens should carry no `azp` and pass, but this hasn't been verified against your instance.
9. **Fonts:** iOS uses SF Pro and SF Mono rather than bundling Manrope or JetBrains Mono.
10. **No app icon artwork yet.** The asset catalog slot is empty.

## Documentation

- [Documentation/IMPLEMENTATION_PLAN.md](Documentation/IMPLEMENTATION_PLAN.md): findings, milestones, open decisions
- [Documentation/BACKEND_CONTRACT.md](Documentation/BACKEND_CONTRACT.md): every endpoint and event used, plus the contract gaps
- [Documentation/DEVICE_TEST_PLAN.md](Documentation/DEVICE_TEST_PLAN.md): physical-device checklist
- [PRD.md](PRD.md): product requirements
