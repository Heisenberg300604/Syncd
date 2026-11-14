# SyncD — AI Agent Instructions

## Project

SyncD is a lightweight social music-listening application.

Core product flow:

Landing → Authentication → Onboarding → Home → Create/Join Room → Shared Listening → Chat

The project is being developed incrementally by phases.

---

## Current Technology

### Backend

- Node.js
- Express
- TypeScript
- Prisma
- PostgreSQL
- Neon
- Socket.IO
- Clerk authentication

### Frontend

Use the existing frontend stack and architecture.

Do not replace the existing frontend framework, router, state management, styling system, or API client unless explicitly requested.

---

## Core Engineering Rules

### 1. Inspect before modifying

Before implementing a feature:

1. Read this file.
2. Read `docs/CURRENT_STATE.md`.
3. Read `docs/ARCHITECTURE.md` when relevant.
4. Inspect the existing implementation related to the task.
5. Follow the existing project conventions.

Do not assume the architecture from documentation alone.

The existing codebase is the source of truth.

---

### 2. Do not rewrite working features

Existing working functionality includes:

- Authentication
- User onboarding
- User persistence
- Room creation
- Room joining
- Room retrieval
- Room leaving
- Room membership

Do not rewrite these systems unless the requested feature requires a specific change.

If an existing implementation has a bug that blocks the requested feature, make the smallest safe correction.

---

### 3. Keep changes scoped

Only modify files necessary for the requested task.

Do not:

- refactor unrelated code
- rename unrelated files
- restructure the project unnecessarily
- replace existing libraries
- introduce a new architecture
- create duplicate utilities
- create duplicate API clients
- create duplicate authentication systems

Prefer the smallest clean implementation that fits the existing architecture.

---

## Backend Rules

The backend is TypeScript + Express.

Follow the existing backend structure.

Prefer:

- strong typing
- async/await
- explicit types at important boundaries
- validation of external input
- centralized error handling
- thin controllers where the existing architecture supports services
- reusable business logic
- Prisma-generated types

Avoid `any`.

Do not add abstractions unless they provide a real benefit.

---

## Authentication

Clerk is the authentication provider.

Authentication already exists.

Do not rebuild authentication.

The backend must derive the authenticated application user from the existing verified authentication mechanism.

Never trust a client-provided:

- userId
- clerkUserId
- username
- host status
- role
- permission

The frontend is never the authority for identity or authorization.

---

## Authorization

Authentication answers:

> Who is the user?

Authorization answers:

> Is this user allowed to perform this action?

The backend must enforce authorization.

For room operations, use the existing `User`, `Room`, and `RoomMember` relationships.

Never rely on the frontend hiding a button as an authorization mechanism.

---

## Database

The database is:

- PostgreSQL
- Neon
- Prisma

The existing Prisma schema is the source of truth.

Current MVP models:

- User
- Room
- RoomMember
- Message

Do not redesign the schema without a clear requirement.

Do not create duplicate models.

Use database constraints for important invariants.

Examples:

- unique Clerk user ID
- unique username
- unique room code
- unique `(roomId, userId)` membership

Use Prisma transactions when multiple database operations must succeed atomically.

Never run destructive migrations, resets, or data deletion without explicit approval.

---

## Real-Time Architecture

Socket.IO is used for live room communication.

Keep these concepts separate:

### PostgreSQL / Prisma

Persistent application data and membership.

### Socket.IO

Ephemeral real-time state such as:

- presence
- room events
- playback events
- chat events

Do not store temporary online/offline presence in PostgreSQL unless explicitly required.

---

## Frontend Rules

Inspect the existing frontend architecture before changing it.

Reuse:

- existing router
- existing API client
- existing authentication state
- existing components
- existing styling
- existing state management
- existing loading/error patterns

Do not introduce a new library if the project already has an appropriate solution.

Frontend validation is for user experience.

Backend validation remains authoritative.

---

## API Rules

Follow the existing API conventions.

For new APIs:

- authenticate requests
- validate input
- authorize the user
- use appropriate HTTP status codes
- return predictable response shapes
- avoid leaking internal errors
- avoid exposing unnecessary database fields

Do not trust client-provided identity.

---

## TypeScript Rules

Prefer type-safe code.

Avoid:

```ts
any