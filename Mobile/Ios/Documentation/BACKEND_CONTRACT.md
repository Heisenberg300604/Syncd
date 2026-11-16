# SyncD iOS — Backend Contract

Every endpoint and event below was read from `server/src`. The Swift DTOs in
`SyncD/Core/Models` mirror these shapes field-for-field. If the server changes,
update both together.

## 1. Configuration

| Value | Source | Notes |
| --- | --- | --- |
| API base URL | `SYNCD_API_BASE_URL` (xcconfig → Info.plist) | Includes `/api`, same as web `VITE_API_BASE_URL`. |
| Socket URL | derived | API base with trailing `/api` removed — identical to `client/src/config` `socketUrl`. |
| Clerk publishable key | `SYNCD_CLERK_PUBLISHABLE_KEY` | Publishable only. No secret key ever ships in the app. |

## 2. REST (`/api`, all `requireAuth` except health)

Auth header: `Authorization: Bearer <Clerk session token>`.
Error body: `{ "message": string }` (401 from `requireAuth` adds `authenticated: false`).
429 responses carry `Retry-After` seconds.

| Method | Path | Response |
| --- | --- | --- |
| GET | `/me` | `{ authenticated, user: PublicUser \| null, onboardingComplete }` |
| POST | `/users/profile` `{ username }` | `{ user: PublicUser }` — 3–20 chars `[A-Za-z0-9_]`, 409 if taken |
| POST | `/rooms` | 201 `{ room: RoomDTO }` |
| POST | `/rooms/:code/join` | `{ room: RoomDTO }` |
| GET | `/rooms/:code` | `{ room: RoomDTO }` (members only) |
| POST | `/rooms/:code/leave` | `{ left: true }` |
| GET | `/music/search?q=` | `{ results: YouTubeSearchResult[] }` |
| GET | `/music/video?url=` | `{ result: YouTubeSearchResult }` |
| GET | `/music/playlist?url=` | `{ results, playlistTitle? }` |

Room codes: 6 chars from `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, normalised to upper case server-side.

## 3. Socket.IO (v4 server, `transports: ["websocket"]`)

Handshake: `auth: { token }`. The token is verified once at connect. Clerk
session tokens live ~60 s, so **every (re)connect must fetch a fresh token** —
the iOS client disables Socket.IO's built-in reconnection and runs its own
backoff loop that refreshes the token on each attempt.

### Client → server (all ack `{ ok: true, ... } | { ok: false, message }`)

| Event | Payload | Ack | Permission |
| --- | --- | --- | --- |
| `room:join` | `{ roomCode }` | `{ ok, presence, playback?, messages, queue }` | member |
| `room:leave` | `{ roomCode }` | none (empty) | — |
| `playback:set` | `{ roomCode, track: { videoId, title, thumbnailUrl, duration(ISO8601) } }` | `{ ok, playback }` | host |
| `playback:control` | `{ roomCode, action: play\|pause\|seek, position }` | `{ ok, playback }` | host |
| `playback:clear` | `{ roomCode }` | `{ ok, playback }` | host |
| `queue:add` / `queue:prepend` | `{ roomCode, track }` | `{ ok, queue }` / `code: QUEUE_FULL` | host |
| `queue:remove` | `{ roomCode, index }` | `{ ok, queue }` | host |
| `queue:reorder` | `{ roomCode, fromIndex, toIndex }` | `{ ok, queue }` | host |
| `queue:advance` | `{ roomCode, expectedFrontVideoId? }` | `{ ok, queue }` | host |
| `queue:clear` | `{ roomCode }` | `{ ok, queue }` | host |
| `chat:send` | `{ roomCode, content }` (1–500 chars) | `{ ok }` | member |
| `host:transfer` | `{ roomCode, userId }` | `{ ok, message? }` | host |

### Server → room broadcasts

| Event | Payload |
| --- | --- |
| `presence:update` | `{ members: [{ userId, username, online }], hostUserId }` |
| `playback:update` | `PlaybackSnapshot` |
| `queue:update` | `QueueItem[]` |
| `chat:new` | `{ id, roomId, userId, username, content, createdAt }` |
| `host:update` | `{ hostUserId, hostUsername, previousHostUserId, previousHostUsername, reason: manual\|disconnect\|left }` |
| `host:pending` | `{ pending, hostUserId, hostUsername, successorUsername?, deadline? }` |

### Playback snapshot semantics

```
position(t) = snapshot.position + (isPlaying ? (serverNow - updatedAt) : 0)
```

`serverNow` is estimated from `serverTime` fields via `ServerClock`
(lower/upper-bound offset estimation); the device wall clock is never trusted
directly. `updatedAt` is rewritten on every `set`/`control`/`clear`, so it is
used as the ordering key for stale-event rejection.

Echo/feedback: the iOS client only emits `playback:control` from explicit user
intents (buttons, remote commands). Engine state changes caused by applying a
snapshot are never emitted.

Auto-advance: when the current track ends, **only the host's client** emits
`queue:advance { expectedFrontVideoId }`. The guard makes duplicate advances
from multiple host devices idempotent.

## 4. Contract gaps

### 4.1 Native-playable sources (blocking background room audio)

`PlaybackSnapshot` and `QueueItem` only carry `videoId`. Proposed **additive**
extension (old clients keep working because they ignore unknown fields):

```ts
type TrackSource =
  | { kind: "youtube"; videoId: string }
  | { kind: "hostStream"; trackId: string; hostUserId: string };

interface PlaybackSnapshot {
  // existing fields unchanged …
  source?: TrackSource;   // absent ⇒ { kind: "youtube", videoId }
  revision?: number;      // monotonically increasing per room
}

// New, authenticated, membership-checked:
// POST /api/rooms/:code/stream-ticket { trackId }
//   → { url: string /* short-lived signed HTTPS URL, supports Range */, expiresAt }
```

The signed URL avoids long-lived credentials on the device and never exposes
filesystem paths. A relay is required when the host PC is not directly
reachable; that is a server/host-agent decision, not an iOS one.

### 4.2 Room discovery

No list endpoint and no visibility field on `Room`. Needs `Room.visibility`
(schema change) and `GET /api/rooms?visibility=public` returning a
`RoomSummary { roomCode, host, memberCount, onlineCount, currentTitle }`.

### 4.3 Recently joined rooms

No endpoint. iOS keeps a local SwiftData cache (non-authoritative, cleared on
sign-out).

### 4.4 Revision numbers

No `revision` on snapshots. iOS orders by `updatedAt`; two mutations in the
same millisecond would be indistinguishable. Low risk at current rate limits.

### 4.5 Web client token refresh on reconnect (observed, not changed)

`client/src/hooks/useRoomSocket.ts` passes a fixed token to `io()`. Socket.IO
reuses it on automatic reconnects, so a reconnect more than ~60 s after the
initial connect would be rejected as expired. Out of scope for the iOS work;
flagged for the web team.
