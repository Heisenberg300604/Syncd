# SyncD iOS — Implementation Plan

Last updated: 2026-11-14

This plan is derived from inspecting the actual repository (`server/src`,
`client/src`, `docs/`), not from the PRD alone. Where the PRD and the backend
disagree, the backend wins and the gap is listed in
[BACKEND_CONTRACT.md](BACKEND_CONTRACT.md#contract-gaps).

## 1. What exists today

| Area | Reality in the repo |
| --- | --- |
| iOS project | None. Added at `ios/` (sibling of `client/`, `server/`). |
| Android project | Not in this repository. No Android protocol to mirror beyond the shared backend. |
| Auth | Clerk. REST: `Authorization: Bearer <session JWT>` via `clerkMiddleware`. Socket: `handshake.auth.token`. |
| REST | `/api/me`, `/api/users/profile`, `/api/rooms`, `/api/rooms/:code{,/join,/leave}`, `/api/music/{search,video,playlist}`. |
| Socket events | `room:join`, `room:leave`, `playback:{set,control,clear}`, `queue:{add,prepend,remove,reorder,advance,clear}`, `chat:send`, `host:transfer` → broadcasts `presence:update`, `playback:update`, `queue:update`, `chat:new`, `host:update`, `host:pending`. |
| Media sources | **YouTube video IDs only.** No stream URLs, no host-PC streaming, no source type field. |
| Room discovery | **No list endpoint.** Rooms are reachable only by 6-char code. |
| Sync protocol | `PlaybackSnapshot { videoId, title, thumbnailUrl, duration, isPlaying, position, updatedAt, serverTime }`. No revision number, no rate field (rate is implicitly 1.0). |
| Permissions | Host-only for every playback/queue mutation and host transfer. Any member may chat. Host is dynamic (`hostUserId` on every `presence:update`). |

## 2. Consequences for the iOS PRD

1. **AVPlayer has no eligible room source yet.** The PRD forbids extracting
   YouTube audio. Room tracks (YouTube) can only be rendered through YouTube's
   official embedded player, which is foreground-only and cannot drive the
   lock screen. Background playback of *room* audio therefore depends on a new
   backend source contract (proposed in BACKEND_CONTRACT.md §4).
2. The AVPlayer engine, audio session, Now Playing and remote-command stack are
   still built now — they are source-agnostic — and are exercised on device via
   a clearly-labelled **local file playback** mode (not shared with any room).
3. "Discover" cannot list rooms. Until a contract exists, Discover is
   **join-by-code + recently joined rooms** (local SwiftData cache), and the
   UI says so rather than showing fake rooms.
4. Stale-event rejection uses `updatedAt` (server-written on every mutation)
   because there is no revision field.

## 3. Architecture

Feature-based MVVM with service boundaries, per the iOS PRD. Swift 6 language
mode, strict concurrency. UI state and services are `@MainActor`; models are
`Sendable` value types; pure sync math is `nonisolated` and unit-tested.

```
SyncD/
├── App/                 SyncDApp, AppDependencies, RootView (coordinator)
├── Core/
│   ├── Configuration/   AppConfiguration (Info.plist ← xcconfig)
│   ├── Authentication/  Clerk adapter, SessionStore
│   ├── Networking/      APIClient, Endpoint, SyncDAPI
│   ├── Realtime/        RoomSocketClient (Socket.IO), RoomEvent, payload decoding
│   ├── Persistence/     SwiftData RecentRoom + repository
│   ├── Models/          DTOs mirroring server/src/**/*.types.ts exactly
│   ├── DesignSystem/    Tokens (mirrors client/src/index.css @theme), components
│   ├── Errors/          APIError, SocketError, PlaybackError
│   └── Utilities/       ISO 8601 duration, JSON coding, monotonic clock
├── Features/            Authentication, Home, Rooms, Player, Queue, Chat, Profile
└── Playback/
    ├── Engine/          AudioEngine protocol + AVPlayerAudioEngine
    ├── Session/         AudioSessionManager + InterruptionPolicy
    ├── NowPlaying/      MPNowPlayingInfoCenter
    ├── RemoteCommands/  MPRemoteCommandCenter
    ├── Synchronization/ ServerClock, PlaybackTimeline, DriftPolicy, SnapshotSequencer
    ├── Coordinator/     PlaybackCoordinator (single owner of the engine)
    └── Models/          PlaybackSource (+capabilities), PlaybackItem, EngineState
```

Ownership rules:

- Exactly one `AVPlayer` for the app's lifetime, owned by `AVPlayerAudioEngine`,
  owned by `PlaybackCoordinator`, owned by `AppDependencies`. Views never create
  players; the mini-player and full player both read the coordinator.
- The socket client never holds a reference to the engine. A dropped socket
  does not stop audio.
- Remote commands and in-app controls go through the same coordinator method,
  so the lock screen cannot bypass room permissions.

## 4. Milestones

| # | Milestone | Status |
| --- | --- | --- |
| 1 | Foundation: Xcode project, config, design system, networking, Clerk auth, onboarding, models | **Built + unit-tested.** App launches; Clerk loads. Full sign-in not yet run end to end. |
| 2 | Playback engine: AVPlayer engine, audio session, interruptions/routes, Now Playing, remote commands, local-file mode | **Built.** Policies unit-tested. **Needs physical-device validation** (DEVICE_TEST_PLAN.md §A). |
| 3 | Player experience: mini-player, full player, queue UI | **Built.** |
| 4 | Real-time listening: socket client, join/rejoin, sync coordinator, drift correction | **Built + unit-tested.** Not yet run against a live server. Room audio blocked on decision §5.1. |
| 5 | Social: participants, chat, profile, search | **Built.** Public discovery blocked on §5.3. |
| 6 | Reliability: reconnection hardening, host-PC streaming, accessibility, device testing | Partial: reconnection and accessibility labels done. Host-PC streaming blocked on §5.2. Device pass not started. |

## 5. Decisions needed from the product owner

1. **How should room (YouTube) tracks play on iOS?** Options:
   (a) official YouTube embedded player (WKWebView, foreground-only, no lock
   screen) for parity with web; (b) iOS listens silently (follows state, no
   audio) until a non-YouTube source exists; (c) both, (a) as default.
   Recommendation: (c).
2. **Host-PC streaming contract** (BACKEND_CONTRACT.md §4) — required before
   any room audio can play in the background.
3. **Room discovery** — public/private rooms need a schema field and a list
   endpoint; neither exists.
4. **Clerk dashboard** — enable Native API and register the iOS bundle ID /
   Team ID; confirm socket `authorizedParties` accepts native tokens (native
   tokens carry no browser `azp`; verify on a device against the dev instance).
