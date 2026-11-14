# SyncD Android

Native Android client for **SyncD**, a social synchronized-listening platform. Users can discover and join listening rooms, listen together, manage a shared queue, see participants, and chat in real time.

> **Status:** In development  
> **Platform:** Android  
> **Stack:** Kotlin · Jetpack Compose · AndroidX Media3

## Product direction

SyncD is centered on shared listening sessions, not merely a standalone music player. The Android app connects to the existing SyncD backend and shares room, queue, presence, and playback state with the other clients.

Android and iOS are separate native codebases. This document covers Android only.

## MVP scope
- Existing SyncD authentication and session handling.
- Home screen and room discovery.
- Create, join, and leave rooms.
- Participant presence and basic room chat.
- Shared queue and supported queue operations.
- Native playback for eligible sources.
- Server-authoritative playback synchronization.
- Background playback through a Media3 playback service.
- Android media notification, lock-screen, and system controls.
- Persistent in-app mini-player and full-screen player.
- Reconnect and playback recovery.

## Technology

| Area | Technology |
|---|---|
| Language | Kotlin |
| UI | Jetpack Compose |
| Playback | AndroidX Media3 ExoPlayer |
| Background playback | Media3 `MediaSessionService` / `MediaSession` |
| Architecture | ViewModel, repositories, Coroutines, Flow |
| Navigation | Navigation Compose |
| HTTP | Retrofit + OkHttp, unless repository conventions differ |
| Real-time | Socket.IO client compatible with existing backend |
| Local cache | Room, where useful |
| Preferences | DataStore |
| Secure storage | Android Keystore-backed storage |
| Tests | JUnit, coroutine tests, MockWebServer, Compose UI tests |
| Build | Gradle Kotlin DSL and version catalog |

Choose current stable, mutually compatible versions during implementation and centralize them in the version catalog.

## Architecture

```text
core/{auth,network,socket,database,datastore,model,design}
data/{remote,local,repository,mapper}
domain/{model,repository,usecase}
playback/{engine,service,session,coordinator,synchronization,source}
feature/{auth,home,rooms,room,player,queue,search,chat,profile,settings}
navigation/
di/
```

Keep UI, domain logic, data access, networking, and playback lifecycle separate. The Media3 player and media session must be owned by a long-running playback service, not by a Compose screen or Activity. Screens bind to and observe the active playback session.

## Background playback

Use Media3 ExoPlayer for sources SyncD is authorized to play. The playback service should own the active player and media session, continue eligible playback while backgrounded or screen-locked, publish metadata and system controls, and handle audio focus, noisy routes, Bluetooth/headset controls, and interruptions.

Background playback depends on provider permissions, source capabilities, Android foreground-service rules, and device behavior. Do not assume every source is eligible.

### YouTube/provider restrictions

Do not extract YouTube audio, scrape streams, bypass official playback, or implement prohibited YouTube background audio. If YouTube content is supported, use a compliant provider-supported visible playback experience and disable unsupported background/audio-only behavior. Source eligibility must be explicit in the domain model and UI.

## Synchronization

The backend/room host is authoritative for shared playback state. Android clients reconcile local playback with actual server state; local state is not canonical. Use real backend timestamps, positions, playback status, and sequence information. If the backend lacks timing information, document the integration gap and coordinate a backward-compatible server change. Do not invent event names or timing fields.

A transient socket disconnect should not automatically stop otherwise valid local playback. On reconnect, reconcile with authoritative room state.

## Backend integration

Reuse the existing SyncD backend, authentication provider, API, database, and Socket.IO contracts. Do not create a separate mobile backend. Before integration, document actual routes, schemas, token refresh behavior, event names/payloads, queue transitions, and streaming authorization. Do not silently alter contracts used by the web client.

## Host-PC streaming

If the desktop host-streaming feature exists, integrate only through its documented authenticated contract. Use short-lived authorization and HTTP Range where supported. Never expose raw filesystem paths or assume LAN/P2P connectivity will work on every network.

## Setup

1. Install a current stable Android Studio release and compatible JDK.
2. Clone the SyncD repository and open the Android project.
3. Configure the development API base URL and public client configuration using the project's local configuration mechanism.
4. Start the existing SyncD backend using its own setup instructions.
5. Run on an emulator or physical Android device.

Exact setup values depend on the repository and auth configuration. Do not commit secrets, production credentials, signing keys, or private stream tokens. Example config files must use placeholders.

## Permissions and platform behavior

Declare only permissions needed by implemented features. Follow current Android foreground-service and notification requirements for the app's target SDK. Request runtime permissions only when needed and explain their purpose. Test background playback on physical devices and representative Android versions; OEM battery management can affect long-running behavior.

## Testing

Automated tests should cover API serialization/repositories, auth expiry, socket reconnect/resubscription, room/presence/chat/queue state, playback coordination, synchronization, source eligibility, ViewModel state, and critical Compose flows.

Manual tests should cover background and screen-off playback, notification/lock-screen controls, Bluetooth/headset unplug, audio focus, network recovery, host disconnect, stream expiry, and service/process recreation.

## Development principles
- Native Android UI and playback.
- One shared backend contract across clients.
- Server-authoritative room state.
- Explicit source capability and provider compliance.
- Testable playback coordination.
- No secrets in the client.
- Honest loading, buffering, offline, and unsupported-source states.

## Roadmap

**MVP:** Authentication, room discovery/create/join, presence, shared queue, basic chat, eligible-source playback, background playback, system controls, mini-player, and synchronization.

**Later:** Richer discovery, listening history, friend features, advanced playlists, push notifications, permitted offline features, and deeper desktop integration.

## Known limitations

Feature availability depends on the actual backend contracts, source-provider permissions, streaming implementation, and Android platform restrictions. Document unresolved dependencies rather than simulating production behavior.
