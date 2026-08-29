# SyncD — Current State

Last updated: 2026-08-29

## Current Phase

Phase 7 — Real-Time Chat + Room UI Refinement

Status: COMPLETE

---

## Completed

### Authentication

- Clerk authentication
- Google login
- Existing authentication flow
- Backend authentication verification

### User Onboarding

- Username onboarding
- SyncD application user
- User persistence in PostgreSQL

### Database

- Neon PostgreSQL
- Prisma
- User model
- Room model
- RoomMember model
- Message model

### Rooms (Phase 3)

- Create Room
- Unique room code
- Creator becomes host
- Creator becomes room member
- Join Room
- Get Room
- Leave Room
- Room page

### Real-Time Presence (Phase 4)

- Socket.IO authenticated with Clerk JWT
- Room membership authorization
- Live presence updates (join/leave/disconnect/reconnect)
- Multiple-tab handling
- In-memory presence store (no database changes)
- Connection status indicator

### YouTube Integration (Phase 5)

- YouTube Data API v3 search (backend)
- `GET /api/music/search?q=<query>` endpoint
- `GET /api/music/video?url=<link>` endpoint — resolves a pasted YouTube link
  (watch/shorts/embed/live/youtu.be, or a bare video id) to the same shape as
  search results, rejecting videos the IFrame player cannot embed
- YouTube API key kept server-side
- Music search UI component, extended to accept a pasted link as an
  alternative to a search query
- YouTube IFrame Player integration, with the player container always mounted
  so the player initializes even before a video is selected

### Playback Synchronization (Phase 6)

- Server-authoritative playback state, stored on the existing `Room` fields
  (`currentVideoId`, `currentTitle`, `currentThumbnailUrl`, `currentDuration`,
  `isPlaying`, `playbackPosition`, `playbackUpdatedAt`, `playbackUpdatedById`)
  — no schema changes were needed
- Socket.IO events: `playback:set` (load a track), `playback:control`
  (play / pause / seek), `playback:clear`, broadcast to the room as
  `playback:update`
- Host-only authorization enforced server-side (`assertHost` in
  `sockets/index.ts`, backed by `getRoomHostId`) — a non-host mutation is
  rejected with an ack error and the room state is unchanged; the frontend
  hiding controls for non-hosts is a UX nicety, not the security boundary
- Initial sync: the current playback snapshot is included in the
  `room:join` acknowledgment, so a fresh join or a reconnect after a dropped
  socket both recover state the same way — no event replay
- Timestamp-based position: clients derive the current playhead from
  `playbackPosition + (serverTime - playbackUpdatedAt)` when playing, so
  network latency doesn't leave joiners behind the host
- Drift correction: a 5-second client-side check reseeks if the local player
  drifts more than 2 seconds from the expected position; no per-second writes
  to PostgreSQL — only `set` / `control` / `clear` persist
- Echo-loop prevention: the client distinguishes a local user action (which
  emits to the server) from a remote snapshot being applied to the local
  player (which is suppressed for a short window so it isn't re-emitted)
- Play / pause / seek controls, progress bar, loading / error / ended states

### Real-Time Chat (Phase 7)

- `Message` model was already correctly shaped for this (`id, roomId, userId,
  content, createdAt`, indexed on `(roomId, createdAt)`) — no migration
- Socket.IO events, following the existing `domain:action` convention:
  `chat:send` (client → server), `chat:new` (broadcast to the room)
- Persist-before-broadcast: `chat:send` writes to PostgreSQL first; if the
  write fails, nothing is broadcast and the sender gets an error ack
- Authorization reuses the same `assertJoined` membership check playback
  already uses — any room member may chat (unlike playback, which is
  host-only)
- Validation: reject empty/whitespace-only content, cap at 500 characters
  (`messages.validation.ts`)
- History delivery reuses the existing `room:join` ack — the same mechanism
  presence and playback already use for initial sync and reconnection — rather
  than a separate REST endpoint. The ack now also carries the 50 most recent
  messages, oldest first
- No optimistic sending: the input clears and shows a brief "sending" state,
  but a message only appears once the server's `chat:new` broadcasts it back
  (this app's playback/presence features follow the same wait-for-server
  pattern, so chat matches rather than introducing a new one)
- Reconnection merges the fresh history snapshot into existing client state by
  message `id` instead of replacing it, so a message already rendered from a
  live broadcast is never dropped by a slightly-stale snapshot race
- Content safety: React already escapes all rendered text (no
  `dangerouslySetInnerHTML` anywhere in the client); the backend additionally
  trims and length-caps as defense in depth

### Room UI Refinement (Phase 7)

- `/room/:roomCode` restructured into a two-column layout on `lg`+ screens:
  player + playback controls on the left (wider column), participants + live
  chat stacked on the right; single-column stack on smaller screens
- Folded the standalone "Host" card into the "Members" list, which already
  showed a "Host" badge next to that member — removed a redundant display,
  not a feature
- Added a "Copy" button next to the room code (clipboard write, with brief
  "Copied!" feedback)
- Chat panel has its own internal scroll region (message list scrolls
  independently of the page), auto-scrolls to new messages only when the
  reader is already near the bottom, and shows a "↓ New messages" pill
  otherwise
- Reused the existing card visual language (`bg-zinc-950/50 border
  border-white/10 rounded-2xl backdrop-blur-xl`) and violet/zinc palette
  throughout — no new design tokens introduced

### Onboarding Reliability

- `/me` is now fetched once per signed-in session via a shared
  `CurrentUserProvider`/context instead of once per route mount
- A failed or slow `/me` request (stale token right after the Clerk redirect,
  a network blip, a 500) no longer routes the user to onboarding — only a
  successful response with `onboardingComplete: false` does; other failures
  show a retryable error screen instead
- Completing onboarding seeds the shared cache directly from the profile
  creation response, instead of relying on a second `/me` round trip that
  could race the redirect to `/home`

---

## Important Architecture Decisions

### Persistent Membership

PostgreSQL / Prisma `RoomMember` represents persistent room membership.

### Live Presence

Socket.IO represents temporary live presence.

Do not store online/offline presence in PostgreSQL for the MVP.

### Authentication

Clerk remains the authentication provider.

Do not rebuild authentication.

### Authorization

The backend is authoritative.

Never trust frontend-provided:

- userId
- clerkUserId
- host status
- permissions

### Room Host

The creator of a room is the host and is also a `RoomMember`.

### Database

Existing Prisma schema is the source of truth.

Do not redesign it without a concrete requirement.

### YouTube API Key

The YouTube Data API key is stored server-side in `YOUTUBE_API_KEY`.

The frontend never has access to the API key.

The backend proxies search requests and returns only the fields the frontend needs.

### Playback Authority

The `Room` row is the single source of truth for what is playing, its
position, and play/pause state — the same fields used for the read-only
Phase 5 display now double as the authoritative Phase 6 state.

Only the room's host may mutate playback. This is enforced in the Socket.IO
handlers, not just hidden in the UI.

Clients never treat their own YouTube player as authoritative; they reconcile
it against the server snapshot on every `playback:update` and on join/reconnect.

### Current User Caching

`/me` is fetched once per signed-in session and shared via context, not
re-fetched by every route guard. Route guards read the shared state; they do
not each own a fetch.

### Chat History Delivery

Chat history rides the existing `room:join` socket ack — the same mechanism
presence and playback already use — rather than a separate REST endpoint.
This was a deliberate choice to avoid a second, redundant path to the same
per-room data; it means chat becomes available exactly when the socket
connects, same as the other two.

### Room Member List Source

The room's member list renders from the live `presence` state (refreshed on
every join/leave/disconnect), not the one-time REST snapshot fetched when the
page loads. Rendering from the static snapshot was a bug — a member who
joined after the page loaded never appeared until a manual refresh.

---

## Not Started

- Queue implementation
- Security hardening
- UI polish
- Deployment

## Known Limitations

- Drift correction is threshold-based (reseek past 2s drift, checked every
  5s), not frame-accurate — acceptable for casual co-watching, not for
  anything requiring sample-accurate sync
- If the host disconnects, playback state freezes where it was; there is no
  host transfer or automatic pause-on-host-leave yet
- Track-change currently starts the track playing immediately
  (`isPlaying: true`) rather than loading paused
- Chat history is capped at the 50 most recent messages per room with no
  pagination — older messages are not retrievable from the UI (they remain in
  PostgreSQL)
- No typing indicators, reactions, edits, or deletion — out of scope for this
  MVP by design

---

## Current Development Rule

Implement one phase at a time.

Backend-first when a backend capability is required.

Verify backend before integrating the frontend.

Do not implement unrelated future functionality.

Update this file when a major phase or architectural decision changes.