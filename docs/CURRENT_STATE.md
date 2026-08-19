# SyncD — Current State

Last updated: 2026-08-19

## Current Phase

Phase 5 — YouTube Integration

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
- YouTube API key kept server-side
- Music search UI component
- YouTube IFrame Player integration
- Play / pause / seek controls
- Progress bar
- Loading / error / empty states
- Playback is local to the current user (not synchronized)

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

---

## Not Started

- Playback synchronization (Phase 6)
- Queue implementation
- Real-time chat (Phase 7)
- Security hardening
- UI polish
- Deployment

---

## Current Development Rule

Implement one phase at a time.

Backend-first when a backend capability is required.

Verify backend before integrating the frontend.

Do not implement unrelated future functionality.

Update this file when a major phase or architectural decision changes.