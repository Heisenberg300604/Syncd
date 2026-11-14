# SyncD Android — Agent Implementation Prompt

Act as the senior Android engineer implementing the native Android version of SyncD, a social synchronized-listening app. The immediate goal is a reliable MVP prototype that integrates with the existing SyncD backend and remains compatible with the web and separate native iOS clients.

## Non-negotiable stack
- Kotlin, Jetpack Compose, AndroidX Media3 ExoPlayer.
- Media3 `MediaSessionService` and `MediaSession` for service-owned background playback and Android system media controls.
- ViewModel, Coroutines, Flow, Navigation Compose.
- Retrofit/OkHttp (or the repository's established HTTP stack).
- Socket.IO client compatible with the existing Node/Socket.IO backend.
- Room for useful local persistence, DataStore for preferences, Android Keystore-backed secure storage for secrets.
- Gradle Kotlin DSL and a version catalog.
Use current stable, mutually compatible dependency versions when implementing.

Do not use Expo, React Native, Flutter, WebView-based UI, Expo Audio/Video, or a separate mobile backend.

## Phase 1: audit before coding
Inspect the complete repository, backend, web client, auth integration, Prisma/database models, API routes, Socket.IO events, tests, and documentation. Produce a contract inventory for authentication, rooms, membership, presence, queue, chat, track metadata, playback state, and streaming. Record exact routes, methods, payloads, auth requirements, event names, acknowledgements, and error behavior.

Never invent endpoint URLs, event names, payload fields, IDs, or token behavior. Do not change existing server contracts just to simplify Android. If a contract is missing, document it and isolate the assumption behind an interface or TODO. Start with the audit, not mock screens built against guessed APIs.

## Architecture
Use clean boundaries between UI, domain, data, networking, and playback. Suggested packages:

```text
core/{auth,network,socket,database,datastore,model,design}
data/{remote,local,repository,mapper}
domain/{model,repository,usecase}
playback/{engine,service,session,coordinator,synchronization,source,model}
feature/{auth,home,rooms,room,player,queue,search,chat,profile,settings}
navigation/
di/
```

A single Gradle app module is acceptable for the prototype if boundaries remain clean. Use explicit UI states: loading, content, empty, error, offline, buffering, and unavailable.

## Playback architecture — critical
The active player must not be owned by a Compose screen or Activity. Implement a Media3 `MediaSessionService` that owns one ExoPlayer and its MediaSession. Add:
- Playback controller/coordinator for commands and room state.
- Source resolver that validates source capabilities and playable URLs.
- Synchronization component for server-authoritative room playback.
- Media metadata integration for title, artist, artwork, duration, and supported actions.
- Lifecycle-safe binding from app screens to the service.

Required behavior for eligible sources:
- Continue playback when app is backgrounded and screen is locked.
- Publish Android media notification and lock-screen/system controls.
- Support play/pause and other actions only when the source supports them.
- Handle audio focus, noisy-route events (e.g. headset unplug), Bluetooth/headset controls, and interruptions.
- Follow current Android foreground-service and notification requirements for the target SDK.
- Avoid duplicate ExoPlayer instances and unnecessary wake locks.
- Validate on physical devices and multiple Android versions; emulator-only testing is insufficient.

### Source/provider restrictions
Only play sources through provider-approved mechanisms. Do not extract YouTube audio, scrape streams, bypass the official player, or implement prohibited YouTube background/audio-only playback. If YouTube content is supported, keep it in a compliant provider-supported visible playback experience and disable unsupported background behavior. Model source capabilities explicitly; never assume every item is eligible for Media3/background playback.

For direct files or host-PC streams, use authorized URLs, supported formats, short-lived credentials where appropriate, and HTTP Range only where the server supports it. Never expose raw host filesystem paths.

## Synchronization
The server/room host is authoritative. Use the actual backend timing and state contract. If it supplies canonical position `P₀`, server timestamp `T₀`, and playback rate, expected position can be estimated as:

`P(T) = P₀ + (T - T₀) × playbackRate`

Apply only when the backend's timestamp semantics support this calculation. Initial drift tuning guidance:
- <250 ms: no correction.
- 250–750 ms: observe/recheck.
- 750 ms–2 s: gradual correction if supported.
- >2 s: authoritative seek when safe and appropriate.

Avoid audible correction loops. Ignore stale/out-of-order events using actual sequence/timestamp fields if present. Define host change/leave, track change, pause, seek, buffering, source failure, and reconnect behavior. A transient Socket.IO disconnect must not automatically destroy valid local playback. On reconnect, reconcile with authoritative room state before correcting. Do not claim synchronized playback while buffering or unable to access the source.

If the backend lacks timing information, document the gap and propose the smallest backward-compatible server enhancement. Do not fabricate timing fields.

## Backend and networking
Reuse existing authentication, API, database, and Socket.IO contracts. Use one managed socket connection per authenticated session, attach credentials exactly as the backend expects, handle expiry/refresh, reconnect, room rejoin, and event resubscription. Expose connection state to the UI. Do not log tokens, private stream URLs, or message content. Do not put privileged credentials in the app.

## Host-PC streaming (conditional)
Only implement if the existing desktop/backend supports it. Inspect the real contract. Handle authorization expiry, host offline, interrupted streams, unsupported formats, and seeking limitations. Do not assume LAN reachability, NAT traversal, or peer-to-peer connectivity.

## MVP screens
1. Authentication and session restoration.
2. Home: recent/discoverable rooms and create/join actions.
3. Room: current track, participants, queue, chat, host/participant permissions.
4. Persistent mini-player.
5. Full-screen player.
6. Search and track selection.
7. Queue management.
8. Profile/settings and connection status.

Build a polished, dark-first native Android UI consistent with SyncD branding. Adapt to Android conventions rather than copying web layouts. Provide loading, empty, error/retry, offline/reconnecting, buffering, unavailable-source, and permission-denied states. Include TalkBack semantics, scalable text, adequate contrast, and accessible touch targets.

## Security
Use HTTPS/WSS in production, secure credential storage, least-privilege manifest permissions, validated deep links/intents, and runtime permission prompts only when needed. Never embed signing keys, privileged credentials, or server secrets.

## Tests and device verification
Automate tests for API models/serialization, repositories, auth expiry, socket reconnect/resubscription, room/queue/chat transitions, synchronization calculations, source eligibility, ViewModel states, and critical Compose flows.

On physical devices verify:
- Background and screen-off playback.
- Notification and lock-screen controls.
- Bluetooth/headset connect/disconnect and unplug.
- Audio focus/interruption behavior.
- Network loss/reconnect during playback.
- Host disconnect and stream expiry.
- Service/process recreation where applicable.
- Multiple Android versions and representative OEM battery-management behavior.

## Delivery sequence
1. Repository audit and contract inventory.
2. Android project, build setup, theme, navigation.
3. Authentication and API integration.
4. Socket, rooms, and presence.
5. Queue and chat.
6. Media3 playback service for an eligible test source.
7. MediaSession, notification, lock-screen controls, and mini-player.
8. Server-authoritative synchronization and reconnect.
9. Host-PC streaming if supported.
10. Tests, hardening, and documentation.

At each phase, build and test. Report changed files, completed behavior, unresolved backend dependencies, and known limitations. Never mark simulated behavior as complete.

## Definition of done
- Clean checkout builds with documented steps.
- Existing SyncD authentication works.
- Users can discover/create/join/leave rooms.
- Presence, basic chat, and shared queue reflect backend state.
- Eligible source playback works through Media3.
- Background playback and Android system media controls work for eligible sources.
- Mini-player and full player control the same service-owned session.
- Room playback converges with server-authoritative state after commands and reconnect.
- Unsupported sources fail safely and honestly.
- Core flows have automated tests and physical-device verification notes.

Begin with the repository audit. Do not guess the backend contract.
