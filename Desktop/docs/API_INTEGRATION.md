# SyncD Desktop — API & Socket.IO Integration Specification

## 1. Overview & Verification Summary

This document defines the verified contracts between **SyncD Desktop** and the existing **SyncD Backend** (`Web/server/`). All specifications herein were extracted directly from the existing TypeScript source code, Prisma schema, and test suite.

**Core Principles:**
1. Zero modifications to existing backend contracts or database schemas.
2. The backend remains the sole authority for identity, room memberships, host status, and room timeline.
3. Desktop must conform strictly to existing payload structures, validation rules, and rate limits.

---

## 2. Authentication Contract (Clerk Integration)

### 2.1 Web vs. Desktop Authentication Model
- **Web:** Uses `@clerk/react` in-browser components. Short-lived session JWT tokens are fetched on demand via `useAuth().getToken()`.
- **Desktop Strategy:** 
  1. Desktop triggers authentication via an OAuth PKCE browser loop (`https://<clerk-domain>/oauth/authorize` or system browser redirected to `http://localhost:<ephemeral-port>/auth/callback` or `syncd://auth-callback`).
  2. The acquired session token is validated against the backend.
  3. Tokens are securely stored in the Windows Credential Manager via native Rust OS APIs (`keyring` crate).
  4. Access tokens are kept in memory and refreshed before expiration; credentials are **never** written to `settings.json`.

### 2.2 Token Validation
Every protected REST and Socket.IO request requires a valid Clerk JWT.
```http
Authorization: Bearer <clerk_session_jwt>
```
On the server, `verifyToken` inspects:
- `secretKey`: `CLERK_SECRET_KEY`
- `authorizedParties`: Array of allowed client origins configured in `CLERK_AUTHORIZED_PARTIES`.

---

## 3. REST API Endpoints

Base URL: `http://localhost:5000/api` (Development) / `https://api.syncd.com/api` (Production)

### 3.1 Health Check
- **Endpoint:** `GET /api/health`
- **Auth:** Public
- **Response:**
  ```json
  {
    "success": true,
    "message": "API is running"
  }
  ```

### 3.2 User Identity & Onboarding

#### Get Current User (`GET /api/me`)
- **Auth:** Required (`requireAuth`)
- **Rate Limit:** 60 requests per minute (`REST_RATE_LIMITS.me`)
- **Response (Success - User exists):**
  ```json
  {
    "authenticated": true,
    "user": {
      "id": "clerk_cuid_12345",
      "clerkUserId": "user_2xxxxxx",
      "username": "zishan"
    },
    "onboardingComplete": true
  }
  ```
- **Response (Success - Needs onboarding):**
  ```json
  {
    "authenticated": true,
    "user": null,
    "onboardingComplete": false
  }
  ```
- **Error (401 Unauthorized):**
  ```json
  {
    "authenticated": false,
    "message": "Unauthorized"
  }
  ```

#### Create Profile / Complete Onboarding (`POST /api/users/profile`)
- **Auth:** Required
- **Rate Limit:** 10 requests per minute (`REST_RATE_LIMITS.createProfile`)
- **Request Body:**
  ```json
  {
    "username": "zishan"
  }
  ```
- **Validation Rules:**
  - `username`: String, 3 to 20 characters, lowercase alphanumeric and underscores only (`/^[a-z0-9_]{3,20}$/`).
- **Response (201 Created):**
  ```json
  {
    "user": {
      "id": "clerk_cuid_12345",
      "clerkUserId": "user_2xxxxxx",
      "username": "zishan"
    }
  }
  ```

---

### 3.3 Rooms Management

#### Create Room (`POST /api/rooms`)
- **Auth:** Required
- **Rate Limit:** 10 requests per minute (`REST_RATE_LIMITS.createRoom`)
- **Behavior:** Generates a unique 6-character room code (e.g., `A7X9K2`). Sets the caller as both `host` and initial `RoomMember`.
- **Response (201 Created):**
  ```json
  {
    "room": {
      "id": "cuid_room_1",
      "roomCode": "A7X9K2",
      "host": {
        "id": "cuid_user_1",
        "username": "zishan"
      },
      "members": [
        {
          "user": {
            "id": "cuid_user_1",
            "username": "zishan"
          },
          "joinedAt": "2026-11-13T20:00:00.000Z"
        }
      ],
      "currentVideoId": null,
      "currentTitle": null,
      "currentThumbnailUrl": null,
      "currentDuration": null,
      "isPlaying": false,
      "playbackPosition": 0,
      "playbackUpdatedAt": null
    }
  }
  ```

#### Get Room Details (`GET /api/rooms/:roomCode`)
- **Auth:** Required (User must be a member of the room)
- **Rate Limit:** 60 requests per minute
- **Response (200 OK):** Same `RoomDTO` structure as Create Room.
- **Errors:** 
  - `400 Bad Request`: Invalid room code format.
  - `404 Not Found`: Room does not exist.
  - `403 Forbidden`: User is not a member of the room.

#### Join Room (`POST /api/rooms/:roomCode/join`)
- **Auth:** Required
- **Rate Limit:** 20 requests per minute
- **Behavior:** Idempotently adds user to `RoomMember` relation.
- **Response (200 OK):** Returns `{ "room": RoomDTO }`.

#### Leave Room (`POST /api/rooms/:roomCode/leave`)
- **Auth:** Required
- **Rate Limit:** 20 requests per minute
- **Behavior:**
  - Removes membership.
  - If user was host: transfers room to the oldest remaining online member inside a transaction.
  - If user was the last remaining member: deletes the room.
  - Sockets held by the leaving user are evicted.
- **Response (200 OK):**
  ```json
  {
    "left": true,
    "roomDeleted": false
  }
  ```

---

### 3.4 Music Proxy Endpoints (YouTube)
*Note: Stored server-side with `YOUTUBE_API_KEY`. Used by Web and Desktop when browsing social tracks.*

- `GET /api/music/search?q=<query>`: Returns YouTube search results matching query.
- `GET /api/music/video?url=<link>`: Resolves video metadata from URL or 11-char ID.
- `GET /api/music/playlist?url=<link>`: Resolves YouTube playlist items.

---

## 4. Socket.IO Real-Time Protocol

### 4.1 Connection & Handshake
- **Transports:** `["websocket"]` only (polling disabled for lower latency).
- **Handshake Auth:**
  ```javascript
  const socket = io(SOCKET_URL, {
    auth: { token: "<clerk-jwt>" },
    transports: ["websocket"]
  });
  ```
- **Connection Security:**
  - Token verified against Clerk on connection.
  - Max buffer size clamped to `100_000` bytes (defense against memory amplification).

---

### 4.2 Client-to-Server Events (with Acknowledgment Callbacks)

#### 1. Join Room (`room:join`)
Must be emitted immediately upon `connect` event.
- **Payload:**
  ```json
  {
    "roomCode": "A7X9K2"
  }
  ```
- **Ack Response (Success):**
  ```json
  {
    "ok": true,
    "presence": {
      "members": [
        { "userId": "cuid_1", "username": "zishan", "online": true },
        { "userId": "cuid_2", "username": "alex", "online": false }
      ],
      "hostUserId": "cuid_1"
    },
    "playback": {
      "videoId": "dQw4w9WgXcQ",
      "title": "Never Gonna Give You Up",
      "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "duration": 213,
      "isPlaying": true,
      "position": 45.2,
      "updatedAt": "2026-11-13T20:15:30.000Z",
      "serverTime": "2026-11-13T20:15:35.000Z"
    },
    "messages": [
      {
        "id": "cuid_msg_1",
        "roomId": "cuid_room_1",
        "userId": "cuid_1",
        "username": "zishan",
        "content": "Welcome to the room!",
        "createdAt": "2026-11-13T20:10:00.000Z"
      }
    ],
    "queue": []
  }
  ```
- **Ack Response (Failure):** `{ "ok": false, "message": "Room not found" }`

#### 2. Leave Room (`room:leave`)
- **Payload:** `{ "roomCode": "A7X9K2" }`
- **Ack:** `() => void`

#### 3. Playback: Set Track (`playback:set`)
*Host-only permission.*
- **Payload:**
  ```json
  {
    "roomCode": "A7X9K2",
    "track": {
      "videoId": "dQw4w9WgXcQ",
      "title": "Never Gonna Give You Up",
      "thumbnailUrl": "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      "duration": "PT3M33S"
    }
  }
  ```
- **Ack Response:** `{ "ok": true, "playback": PlaybackSnapshot }`

#### 4. Playback: Control (`playback:control`)
*Host-only permission.*
- **Payload:**
  ```json
  {
    "roomCode": "A7X9K2",
    "action": "play", // "play" | "pause" | "seek"
    "position": 62.5
  }
  ```
- **Ack Response:** `{ "ok": true, "playback": PlaybackSnapshot }`

#### 5. Playback: Clear (`playback:clear`)
*Host-only permission. Atomically clears playback and the room queue.*
- **Payload:** `{ "roomCode": "A7X9K2" }`
- **Ack Response:** `{ "ok": true, "playback": PlaybackSnapshot }`

#### 6. Queue Events
*All queue mutations are host-only.*
- `queue:add`: `{ roomCode, track: QueueItem }` -> Ack: `{ ok: true, queue: QueueSnapshot }` or `{ ok: false, code: "QUEUE_FULL" }`
- `queue:prepend`: `{ roomCode, track: QueueItem }` -> Ack: `{ ok: true, queue: QueueSnapshot }`
- `queue:remove`: `{ roomCode, index: number }` -> Ack: `{ ok: true, queue: QueueSnapshot }`
- `queue:reorder`: `{ roomCode, fromIndex: number, toIndex: number }` -> Ack: `{ ok: true, queue: QueueSnapshot }`
- `queue:advance`: `{ roomCode, expectedFrontVideoId?: string }` -> Ack: `{ ok: true, queue: QueueSnapshot }`
- `queue:clear`: `{ roomCode }` -> Ack: `{ ok: true, queue: QueueSnapshot }`

#### 7. Chat Send (`chat:send`)
*Any authenticated room member.*
- **Payload:**
  ```json
  {
    "roomCode": "A7X9K2",
    "content": "Great track choice!"
  }
  ```
- **Validation:** 1 to 500 characters, whitespace-trimmed.
- **Ack Response:** `{ "ok": true }` or `{ "ok": false, "message": string }`

#### 8. Host Transfer (`host:transfer`)
*Host-only permission. Hands over room to another member.*
- **Payload:** `{ "roomCode": "A7X9K2", "userId": "cuid_target_user" }`
- **Ack Response:** `{ "ok": true }` or `{ "ok": false, "message": string }`

---

### 4.3 Server Broadcast Events (Server -> All Room Clients)

| Event Name | Payload Shape | Description |
|---|---|---|
| `presence:update` | `PresenceSnapshot` | Live member online/offline status and authoritative `hostUserId`. |
| `playback:update` | `PlaybackSnapshot` | Full room playback timeline, track metadata, and server timestamp. |
| `queue:update` | `QueueSnapshot` | Full snapshot of upcoming tracks in room queue. |
| `chat:new` | `ChatMessageDTO` | New chat message persisted to database. |
| `host:pending` | `HostPendingPayload` | Host disconnected; 30-second grace timer is running with deadline. |
| `host:update` | `HostUpdatePayload` | Host changed (reasons: `"manual"`, `"disconnect"`, `"left"`). |

---

## 5. Critical Contract Constraints & Resolution Strategy

### 5.1 The `videoId` & `thumbnailUrl` Validation Guard
The backend currently enforces strict YouTube constraints on `playback:set` and `queue:add`:
```typescript
export const YOUTUBE_VIDEO_ID_REGEX = /^[A-Za-z0-9_-]{11}$/;
const THUMBNAIL_HOST_SUFFIXES = ["ytimg.com", "ggpht.com", "youtube.com"];
```
**Desktop Architectural Resolution:**
1. **Coexistence with Social Rooms:** In shared rooms, tracks are referenced by their shared identifier (e.g. YouTube ID or future content hash formatted to conform to protocol requirements).
2. **Local Track Matching:** When Desktop receives `playback:update`, it performs a local library lookup:
   - Match by `Title` + `Artist` metadata.
   - Match by exact duration ($\pm 2\text{ seconds}$).
   - Match by custom local linkage mapping stored in SQLite table `social_track_mappings`.
3. If no matching local track exists: The player UI clearly indicates `Missing local audio file for this shared track` with a one-click action to match/link a local file or download if user has a source.

### 5.2 Rate Limit Parameters
SyncD Desktop client must implement throttling to stay safely below backend limits:
- REST `/rooms/:code/join`: Max 20 / min
- REST `/users/profile`: Max 10 / min
- Socket `playback:*`: 20 mutations / min
- Socket `queue:*`: 30 mutations / min
- Socket `chat:send`: 30 messages / min
- Socket `room:join`: 10 joins / min

