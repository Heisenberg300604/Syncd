# SyncD Android — Product Requirements Document

**Status:** Draft for implementation  
**Platform:** Android  
**Product:** SyncD  
**Primary stack:** Kotlin, Jetpack Compose, AndroidX Media3

## 1. Product overview

SyncD is a social synchronized-listening platform. People join shared listening rooms, listen to eligible sources together, manage a common queue, see who is present, and communicate in real time.

The Android application is a native client of the existing SyncD platform. It must interoperate with the web client, backend, and separately maintained native iOS client.

## 2. Goals
1. Deliver a working native Android MVP.
2. Make joining and participating in a listening room straightforward.
3. Keep playback state consistent across room participants.
4. Support reliable background playback for eligible sources.
5. Provide Android-native notification, lock-screen, and media-session controls.
6. Reuse existing backend and authentication contracts.
7. Communicate source restrictions and playback failures clearly.

## 3. Non-goals for MVP
- Replacing or redesigning the backend.
- Building a mobile-specific backend.
- Cross-platform UI or playback implementation.
- Offline downloads unless explicitly supported and permitted.
- Full social graph, advanced recommendations, or music analytics.
- Circumventing provider restrictions or Android background-execution rules.

## 4. Users and primary use cases

**Users:** people who want to listen with friends remotely; room hosts who coordinate playback; participants who join and contribute tracks.

**Use cases:** sign in; discover/create/join a room; see participants; view current track and playback state; add tracks to a shared queue; control playback according to permissions; chat; continue eligible playback in the background; recover after network interruptions.

## 5. Functional requirements

### 5.1 Authentication
- Integrate the existing SyncD authentication provider and flow.
- Support sign-in, sign-out, and session restoration.
- Handle expired/invalid sessions.
- Store credentials securely; never embed privileged secrets.

**Acceptance:** valid users can sign in; valid sessions restore appropriately; expired sessions have a clear recovery path; sign-out clears local authenticated state.

### 5.2 Home and room discovery
- Show authenticated home, recent/discoverable rooms where supported, and create/join actions.
- Display only metadata returned by the backend.

**Acceptance:** loading, empty, error, and populated states exist; selecting a room opens it; no fabricated room activity or counts.

### 5.3 Room lifecycle and membership
- Create, join, and leave rooms through actual backend contracts.
- Reflect host/participant roles and permissions from server state.
- Handle closed/full rooms, invalid invite/code, and unavailable rooms.

**Acceptance:** membership state matches the server; failures do not leave a false joined state.

### 5.4 Participant presence
- Display room participants and live join/leave changes.
- Reconcile presence after reconnect and handle duplicate/stale events safely.

**Acceptance:** presence updates without manual refresh on a healthy connection; reconnect does not duplicate participants.

### 5.5 Shared queue
- Display canonical queue state.
- Support only operations permitted by the backend (e.g. add, remove, reorder, skip).
- Reflect host permissions and reconcile after reconnect.

**Acceptance:** successful operations match server state; unsupported controls are not offered; failed operations restore a consistent view.

### 5.6 Room chat
- Display chronological room messages.
- Send/receive through existing real-time events.
- Represent sending, sent, and failed states; avoid duplicate sends on retry.

**Acceptance:** connected participants receive messages in real time; failed sends can be retried safely.

### 5.7 Native playback
- Use AndroidX Media3 ExoPlayer for eligible sources.
- Own the player in a dedicated playback service.
- Expose state to Compose through a controller/coordinator.
- Show metadata, progress, buffering, and errors when available.
- Avoid duplicate player instances.

**Acceptance:** eligible test media plays/pauses/resumes/stops; mini-player, full player, and notification reflect one session.

### 5.8 Background playback and system controls
- Use Media3 `MediaSessionService` and `MediaSession`.
- Continue eligible playback when backgrounded or screen-locked.
- Publish metadata and supported actions to notification and system media controls.
- Handle audio focus, route changes, headset unplug, Bluetooth controls, and interruptions.
- Follow current target-SDK foreground-service and notification requirements.

**Acceptance:** eligible playback continues in background and with screen locked; supported notification/lock-screen actions work; audio route/focus behavior is verified on physical devices.

### 5.9 Mini-player and full player
- Provide a persistent mini-player in relevant authenticated navigation states.
- Provide a full player with artwork, metadata, progress, controls, and room context.
- Both surfaces control the same service-owned playback session.

**Acceptance:** navigation does not interrupt playback; both surfaces show consistent item and state.

### 5.10 Synchronized playback
- Treat backend/host state as canonical.
- Consume actual backend position, timestamp, playback state, and sequencing data.
- Reconcile play, pause, seek, track change, buffering, host change, and reconnect.
- Avoid audible correction loops and stale-state regressions.

Initial drift tuning guidance (must be validated): under 250 ms, no correction; 250–750 ms, observe/recheck; 750 ms–2 s, gradual correction if supported; over 2 s, authoritative seek when safe. These are starting thresholds, not backend guarantees.

**Acceptance:** joining clients converge toward current room state; commands propagate; reconnect triggers reconciliation; app does not claim sync while buffering/unavailable. Missing timing data is recorded as an integration dependency.

### 5.11 Source eligibility and provider compliance
- Model capabilities explicitly, including background eligibility.
- Do not assume all catalog items use the same playback mechanism.
- Do not extract YouTube audio, scrape streams, bypass official playback, or implement prohibited YouTube background audio.
- If YouTube is supported, use compliant provider-supported visible playback and disable unsupported background/audio-only behavior.
- Explain unsupported sources clearly.

**Acceptance:** ineligible sources cannot enter the background audio path; unsupported playback has a clear UI state.

### 5.12 Host-PC streaming (conditional)
Implement only if the existing desktop/backend feature and contract exist. Use authenticated stream access and short-lived credentials where appropriate; support HTTP Range only if the server does. Handle host offline, expired access, interruption, unsupported formats, and seek limitations. Never expose raw filesystem paths or assume LAN/P2P connectivity.

**Acceptance:** permitted streams open through the documented contract; failures are safe and understandable.

## 6. Navigation / information architecture

Proposed top-level areas (adapt to existing design):
- **Home:** discovery, recent rooms, create/join.
- **Room:** current track, participants, queue, chat.
- **Search:** find eligible tracks/sources and add to queue.
- **Profile/Settings:** account and app preferences.

Show a persistent mini-player where appropriate. Open the full player from the mini-player or current-track surface.

## 7. UI requirements
- Dark-first visual system aligned with SyncD branding.
- Native Android interaction patterns and responsive layouts.
- Explicit states for playing, paused, buffering, reconnecting, unavailable, and error.
- Loading, empty, offline, retry, and permission-denied states.
- TalkBack semantics, scalable text, adequate contrast, and accessible touch targets.
- Do not rely on color alone for status.

## 8. Technical and integration requirements

**Client architecture:** Kotlin, Compose, ViewModel, Coroutines/Flow, repositories, Media3 service-owned playback, and centrally managed Socket.IO connection.

**Backend compatibility:** reuse existing routes, event names, auth, and schemas. Inventory contracts before integration. Do not create mobile-only server behavior without a documented product need. Server-owned state remains authoritative.

**Reliability:** handle timeouts, retries, token expiry, socket reconnect, stale state, and partial failures. Avoid duplicate commands on retry. Provide diagnostics without secrets.

**Security:** HTTPS/WSS in production; secure token storage; no privileged embedded credentials; least-privilege manifest permissions; validate deep links/intents; do not log tokens, private URLs, or sensitive message content.

## 9. Non-functional requirements

| Category | Requirement |
|---|---|
| Reliability | Recover gracefully from transient network loss |
| Performance | UI remains responsive during playback and real-time updates |
| Battery | Avoid excessive polling, wake locks, and duplicate players |
| Compatibility | Validate supported Android versions and target-SDK behavior |
| Accessibility | TalkBack, scalable text, contrast, accessible touch targets |
| Security | Secure credentials and authenticated stream access |
| Maintainability | Testable playback/service/synchronization boundaries |
| Observability | Useful diagnostics without secrets or private message content |

## 10. Required edge cases
- Network unavailable during sign-in.
- Session expiry inside a room.
- Room closed/deleted while occupied.
- Host leaves or disconnects.
- Track unavailable or unsupported.
- Stream authorization expires.
- Buffering or interrupted stream.
- Socket disconnect during playback.
- Duplicate/stale socket events.
- User lacks permission to control playback.
- Audio focus loss or headset unplug.
- Android service/process recreation.
- Notification permission denied where applicable.

Never present stale data as confirmed current state.

## 11. QA and release checklist

**Automated:** API serialization and repository tests; auth expiry; socket reconnect/resubscription; room/queue/chat state; playback coordinator and drift calculations; source eligibility; ViewModel and critical Compose UI tests.

**Manual physical-device tests:** background and screen-off playback; notification and lock-screen controls; Bluetooth/headset behavior; audio focus; network loss/recovery; host disconnect and stream expiry; process/service recreation; multiple Android versions and representative OEM devices.

## 12. Delivery milestones
1. Discovery: repository audit, backend contract inventory, source eligibility map.
2. Foundation: Android project, design system, navigation, build/CI baseline.
3. Identity and rooms: auth, home, create/join, presence.
4. Social layer: queue and chat.
5. Playback foundation: Media3 service and eligible-source playback.
6. Background UX: notification, lock-screen controls, mini-player, full player.
7. Synchronization: server-state reconciliation, drift correction, reconnect.
8. Hardening: device testing, security review, error handling, documentation.

## 13. MVP acceptance checklist
- [ ] Clean checkout builds with documented instructions.
- [ ] Existing SyncD authentication works.
- [ ] User can discover/create/join/leave a room.
- [ ] Participant presence updates in real time.
- [ ] Shared queue reflects canonical backend state.
- [ ] Basic room chat works.
- [ ] Eligible source plays through Media3.
- [ ] Eligible background playback works.
- [ ] Android notification and system media controls work.
- [ ] Mini-player and full player share one playback session.
- [ ] Playback reconciles with server-authoritative room state.
- [ ] Reconnect and host/source failures are handled honestly.
- [ ] Provider restrictions are enforced.
- [ ] Automated tests and physical-device verification notes are included.

## 14. Success criteria

A user can authenticate, join a room, see other participants, add/listen to a queued track, chat, and continue eligible playback in the background with Android-native controls, while room playback remains consistent with the existing SyncD backend.

## 15. Open integration dependencies

Resolve these by inspecting the actual codebase, never by guessing:
- Auth provider SDK/flow and token refresh behavior.
- HTTP API routes and schemas.
- Socket.IO event names and payloads.
- Playback timestamp and sequence semantics.
- Track catalog and source eligibility rules.
- Host-PC streaming availability, authorization, and Range support.
- Room host permissions and host-transfer behavior.
