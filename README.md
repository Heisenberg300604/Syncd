<div align="center">

<img src="client/public/favicon.svg" alt="SyncD Equalizer Icon" width="100" height="100" style="border-radius: 22px; margin-bottom: 14px;" />

# SyncD

### *The Real-Time Social Music-Listening Sanctuary & Synchronized Media Lounge*

[![React 19](https://img.shields.io/badge/React-19.2-21262d?style=flat-square&logo=react&logoColor=61DAFB&labelColor=0d1117)](https://react.dev/)
[![TypeScript 5.8](https://img.shields.io/badge/TypeScript-5.8-21262d?style=flat-square&logo=typescript&logoColor=3178C6&labelColor=0d1117)](https://www.typescriptlang.org/)
[![Vite v8](https://img.shields.io/badge/Vite-v8.2-21262d?style=flat-square&logo=vite&logoColor=FFD62E&labelColor=0d1117)](https://vitejs.dev/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4.3-21262d?style=flat-square&logo=tailwindcss&logoColor=38B2AC&labelColor=0d1117)](https://tailwindcss.com/)

[![Node.js](https://img.shields.io/badge/Node.js-v20+-21262d?style=flat-square&logo=node.js&logoColor=5FA04E&labelColor=0d1117)](https://nodejs.org/)
[![Express v5](https://img.shields.io/badge/Express-v5.2-21262d?style=flat-square&logo=express&logoColor=FFFFFF&labelColor=0d1117)](https://expressjs.com/)
[![Socket.IO v4](https://img.shields.io/badge/Socket.IO-v4.8-21262d?style=flat-square&logo=socket.io&logoColor=010101&labelColor=0d1117)](https://socket.io/)
[![Prisma v7](https://img.shields.io/badge/Prisma-v7.9-21262d?style=flat-square&logo=prisma&logoColor=2D3748&labelColor=0d1117)](https://www.prisma.io/)

[![PostgreSQL Neon](https://img.shields.io/badge/PostgreSQL-Neon_Serverless-21262d?style=flat-square&logo=postgresql&logoColor=4169E1&labelColor=0d1117)](https://neon.tech/)
[![Clerk Auth](https://img.shields.io/badge/Clerk-Authentication-21262d?style=flat-square&logo=clerk&logoColor=6C47FF&labelColor=0d1117)](https://clerk.com/)
[![YouTube API](https://img.shields.io/badge/YouTube-Data_v3-21262d?style=flat-square&logo=youtube&logoColor=FF0000&labelColor=0d1117)](https://developers.google.com/youtube/v3)
[![License ISC](https://img.shields.io/badge/License-ISC-21262d?style=flat-square&logo=opensourceinitiative&logoColor=94A3B8&labelColor=0d1117)](LICENSE)

<br/>

<p align="center">
  <b>⚡ Server-Authoritative Playback</b> &nbsp;•&nbsp;
  <b>🔄 Dynamic Drift Correction (&lt; 2s)</b> &nbsp;•&nbsp;
  <b>🛡️ Host-Guarded Governance</b> &nbsp;•&nbsp;
  <b>💬 Ephemeral Presence &amp; Real-Time Chat</b>
</p>

<p align="center">
  <a href="#-why-syncd">Why SyncD</a> •
  <a href="#-experience-modules">Experience Modules</a> •
  <a href="#-real-time-protocol-specification">Protocol Spec</a> •
  <a href="#-system-architecture">Architecture</a> •
  <a href="#-visual-deep-dives">Deep Dives</a> •
  <a href="#-rest-api-reference">REST APIs</a> •
  <a href="#-database-schema">Database Schema</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-configuration--environment">Configuration</a> •
  <a href="#-directory-structure">Directory Structure</a> •
  <a href="#-roadmap">Roadmap</a>
</p>

---

</div>

<br/>

## 🧭 Why SyncD?

Listening to music with friends online shouldn't require messy screen shares, desynchronized browser tabs, awkward Discord voice bot delays, or compromised audio bitrates.

**SyncD** delivers a dedicated, hyper-synchronized listening sanctuary:

> **Engineered with Node.js, Express, Socket.IO, and React 19**, SyncD fuses **server-authoritative playheads**, **millisecond drift correction**, **zero-latency YouTube media streaming**, and **persistent community rooms** into one unified, warm-sunset cinematic lounge.

<table>
<tr>
<td width="33%" align="center">
<b>🎧 Server-Authoritative Sync</b><br/>
<sub>Playback time is calculated from server timestamps with client-side auto-reseeking when drift exceeds 2 seconds.</sub>
</td>
<td width="33%" align="center">
<b>🛡️ Host-Guarded Governance</b><br/>
<sub>Strict backend authorization ensures only room hosts mutate playback, while every member enjoys real-time chat.</sub>
</td>
<td width="33%" align="center">
<b>🌅 Warm Cinematic Aesthetic</b><br/>
<sub>Curated warm-sunset palette, glowing amber accents, equalizer animations, and high-performance glassmorphism.</sub>
</td>
</tr>
</table>

<br/>

---

## 🎛️ Experience Modules

SyncD organizes the collaborative listening experience across dedicated full-stack modules designed for speed, resilience, and visual warmth:

<table>
<tr>
<td width="50%" valign="top">

### 🌅 1. Cinematic Landing & Brand Showcase
* **Warm Sunset Design Tokens:** Immersive dark charcoal canvas (`#0a0908`), glowing amber accents (`#f7a23b`), and hairline borders (`white/8`).
* **Live Equalizer & Vinyl Showcase:** Animated multi-bar SVG equalizer with staggered delay rhythms and realistic interactive vinyl turntable preview.
* **Responsive Storytelling:** Clean breakdown of features, synchronized listening benefits, and social listening workflows.

</td>
<td width="50%" valign="top">

### 🔐 2. Authentication & Onboarding
* **Clerk OAuth & Google Sign-In:** Secure, token-verified user authentication with automatic session restoration and token rotation.
* **Username Onboarding Flow:** Dedicated reservation step ensuring unique, sanitized display handles stored in PostgreSQL.
* **Single-Fetch Current User Cache:** Centralized `CurrentUserProvider` eliminates redundant `/api/me` network requests during route traversal.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🏠 3. Lounge Dashboard & Room Operations
* **Cryptographic Shortcodes:** 6-character room codes generated via nanoid/crypto algorithms for quick clipboard sharing (`/room/:roomCode`).
* **Instant Room Creation:** Room creators automatically become authoritative hosts and registered members in an atomic transaction.
* **Persistent Membership:** Relational `RoomMember` records track permanent membership independent of ephemeral socket connections.

</td>
<td width="50%" valign="top">

### 🔍 4. YouTube Music Search & URL Resolver
* **Server-Side API Proxy:** YouTube Data API v3 queries proxy securely through Express, keeping credentials hidden from client bundles.
* **Universal URL Parsing:** Resolves YouTube Shorts, standard watch links (`v=`), embeds, live streams, and `youtu.be` links.
* **Embed Safety Checks:** Flags and filters videos blocked by content owners from third-party IFrame playback before loading.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 🎚️ 5. Server-Authoritative Playback Engine
* **Timestamp-Based Playhead:** Clients compute live playback position as `playbackPosition + (now - playbackUpdatedAt)` to eliminate network latency lag.
* **Automatic Drift Reseeking:** A 5-second background interval evaluates local vs expected playhead; if drift > 2s, the player seamlessly reseeks.
* **Echo-Loop Suppression:** Distinguishes user-triggered playback events from remote broadcasts to prevent infinite state re-emission.

</td>
<td width="50%" valign="top">

### 💬 6. Live Presence & Real-Time Chat
* **In-Memory Presence Store:** Ephemeral multi-tab tracking without database overhead, broadcasting live online/offline member statuses.
* **Persist-Before-Broadcast Chat:** Messages write to PostgreSQL first; broadcast occurs only on confirmed write to preserve history.
* **Smart Auto-Scroll & Badging:** Automatically scrolls when at the bottom of the feed; displays an interactive "↓ New messages" pill when scrolled up.

</td>
</tr>
</table>

<br/>

---

## 📡 Real-Time Protocol Specification

SyncD utilizes Socket.IO over WebSockets with Clerk JWT handshake verification. All client-to-server mutations require acknowledgement callbacks (`ack`), ensuring deterministic state updates.

### 1. Socket.IO Event Matrix

| Event Name | Direction | Auth Required | Description | Payload Shape |
| :--- | :--- | :--- | :--- | :--- |
| `room:join` | Client → Server | Verified Member | Joins a room channel and requests snapshot | `{ roomCode: string }` |
| `room:leave` | Client → Server | Joined Socket | Leaves current room channel | `{ roomCode: string }` |
| `playback:set` | Client → Server | **Host Only** | Loads a new track and initiates playback | `{ roomCode: string, track: TrackPayload }` |
| `playback:control` | Client → Server | **Host Only** | Dispatches `play`, `pause`, or `seek` | `{ roomCode: string, action: string, position: number }` |
| `playback:clear` | Client → Server | **Host Only** | Clears the active track from the room | `{ roomCode: string }` |
| `chat:send` | Client → Server | Verified Member | Sends a room chat message (max 500 chars) | `{ roomCode: string, content: string }` |
| `playback:update` | Server → Room | Room Channel | Broadcasts updated server-authoritative playback | `PlaybackSnapshot` |
| `presence:update` | Server → Room | Room Channel | Broadcasts online/offline member list | `PresenceSnapshot` |
| `chat:new` | Server → Room | Room Channel | Broadcasts newly persisted chat message | `ChatMessageDTO` |

<br/>

### 2. Handshake & Acknowledgement Payloads

```ts
// Join Acknowledgement payload received by joining client
interface RoomJoinResponse {
  ok: boolean;
  presence?: {
    members: Array<{ userId: string; username: string; online: boolean }>;
  };
  playback?: {
    videoId: string | null;
    title: string | null;
    thumbnailUrl: string | null;
    duration: number | null;
    isPlaying: boolean;
    playbackPosition: number;
    playbackUpdatedAt: string | null;
    playbackUpdatedById: string | null;
  };
  messages?: Array<{
    id: string;
    roomId: string;
    userId: string;
    username: string;
    content: string;
    createdAt: string;
  }>;
  message?: string;
}
```

<br/>

---

## 🏗️ System Architecture

SyncD decouples persistent domain logic (users, rooms, persistent memberships, chat history) in PostgreSQL from ephemeral real-time state (active sockets, user presence, playback sync) managed by Socket.IO and in-memory caches.

```mermaid
%%{init: {'theme': 'base', 'themeVariables': { 'primaryColor': '#181512', 'primaryTextColor': '#f5f3f0', 'primaryBorderColor': '#f7a23b', 'lineColor': '#f7a23b', 'secondaryColor': '#12100e', 'tertiaryColor': '#201b16' }}}%%
graph TB
    subgraph Presentation ["Frontend Presentation Layer (React 19 • Vite • Tailwind CSS v4)"]
        UI["Application Shell & Router (App.tsx)"]
        LANDING["Cinematic Landing & Brand Showcase"]
        AUTH_VIEW["Clerk Auth & Username Onboarding"]
        HOME_VIEW["Dashboard & Room Manager"]
        ROOM_VIEW["Room Lounge (/room/:roomCode)"]
        YT_PLAYER["YouTube IFrame Player Hook (useYouTubePlayer)"]
        SOCKET_HOOK["Socket Gateway Hook (useRoomSocket)"]
        CHAT_PANEL["Real-Time Chat Panel"]
    end

    subgraph Security ["Identity & Auth Boundary"]
        CLERK["Clerk Authentication Provider (JWT / OAuth)"]
    end

    subgraph ServerCore ["Backend Core (Node.js • Express 5 • TypeScript)"]
        HTTP["Express HTTP API (/api/*)"]
        AUTH_MW["Clerk Token Verification Middleware"]
        SOCKET_SERVER["Socket.IO Server Gateway"]
        USERS_MOD["Users Module & Profile Controller"]
        ROOMS_MOD["Rooms Module (CRUD & Membership)"]
        MUSIC_MOD["Music Module (YouTube Data API v3 Proxy)"]
        PLAYBACK_SVC["Playback Service (Host Authoritative Engine)"]
        MSG_SVC["Messages Service (Chat Persistence)"]
        PRESENCE_STORE["In-Memory Ephemeral Presence Store"]
    end

    subgraph DataLayer ["Persistence & External Services"]
        PRISMA["Prisma ORM v7"]
        NEON["Neon Serverless PostgreSQL DB"]
        YT_API["Google YouTube Data API v3"]
    end

    UI --> AUTH_VIEW
    UI --> HOME_VIEW
    UI --> ROOM_VIEW
    ROOM_VIEW --> YT_PLAYER
    ROOM_VIEW --> SOCKET_HOOK
    ROOM_VIEW --> CHAT_PANEL

    AUTH_VIEW -.-> CLERK
    SOCKET_HOOK -.-> CLERK
    
    SOCKET_HOOK <==>|"WebSocket (JWT Handshake)"| SOCKET_SERVER
    HOME_VIEW -->|"REST / JSON"| HTTP
    ROOM_VIEW -->|"REST / JSON"| HTTP

    HTTP --> AUTH_MW
    SOCKET_SERVER --> AUTH_MW
    AUTH_MW --> USERS_MOD

    HTTP --> ROOMS_MOD
    HTTP --> MUSIC_MOD
    MUSIC_MOD --> YT_API

    SOCKET_SERVER --> PLAYBACK_SVC
    SOCKET_SERVER --> MSG_SVC
    SOCKET_SERVER --> PRESENCE_STORE

    USERS_MOD --> PRISMA
    ROOMS_MOD --> PRISMA
    PLAYBACK_SVC --> PRISMA
    MSG_SVC --> PRISMA
    PRISMA --> NEON
```

<br/>

---

## 🔬 Visual Deep Dives

### 1. Server-Authoritative Playback & Drift Correction

When the host toggles play, pauses, or seeks, the mutation updates the database and broadcasts an authoritative timestamp. Clients derive the playhead mathematically and auto-reseek if local drift occurs:

```mermaid
sequenceDiagram
    autonumber
    actor Host as Room Host
    participant ClientH as Host Client (React 19)
    participant Server as Socket.IO / Server
    participant DB as PostgreSQL (Neon)
    participant ClientJ as Guest Client (React 19)
    participant YT as YouTube IFrame Player

    Host->>ClientH: Clicks Seek to 01:45
    ClientH->>Server: emit("playback:control", { action: "seek", position: 105 })
    Server->>Server: assertJoined() & assertHost()
    Server->>DB: UPDATE rooms SET playbackPosition = 105, isPlaying = true, playbackUpdatedAt = NOW()
    Server-->>ClientH: ack({ ok: true, playback })
    Server->>ClientJ: broadcast("playback:update", playbackSnapshot)
    
    Note over ClientJ,YT: Client calculates expected position:<br/>current = playbackPosition + (now - playbackUpdatedAt)
    ClientJ->>YT: player.seekTo(current) & player.playVideo()
    
    loop Every 5 Seconds (Drift Monitor)
        ClientJ->>YT: readCurrentTime()
        ClientJ->>ClientJ: drift = |readTime - expectedTime|
        opt drift > 2.0s
            ClientJ->>YT: player.seekTo(expectedTime) [Seamless Resync]
        end
    end
```

<br/>

### 2. Room Join & Initial Synchronization Handshake

A single atomic socket handshake delivers presence status, authoritative media playhead, and recent chat history to joining members without redundant HTTP requests:

```mermaid
sequenceDiagram
    autonumber
    actor User as Joining Member
    participant Client as Web App (useRoomSocket)
    participant Socket as Socket.IO Server
    participant Presence as In-Memory PresenceStore
    participant DB as PostgreSQL (Prisma)

    User->>Client: Enters /room/:roomCode
    Client->>Socket: Connect with auth: { token: ClerkJWT }
    Socket->>Socket: verifyToken(token) via Clerk Backend
    Socket-->>Client: Connection Established
    Client->>Socket: emit("room:join", { roomCode: "A1B2C3" })
    Socket->>DB: Verify membership in RoomMember table
    Socket->>Presence: addSocket(roomCode, userId, socketId)
    Socket->>DB: Fetch Room Playback & Top 50 Messages
    Socket-->>Client: ack({ ok: true, presence, playback, messages })
    Socket->>Socket: broadcast("presence:update") to other members
    Client->>Client: Hydrate Player, Render Chat & Mark Host Online
```

<br/>

---

## 🔌 REST API Reference

All protected REST routes require a valid Clerk Bearer JWT passed in the `Authorization` header (`Authorization: Bearer <session_token>`).

| Method | Endpoint | Auth | Description | Response Details |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Public | System uptime & health status | `{ success: true, message: "API is running" }` |
| `GET` | `/api/me` | Authenticated | Fetches current user profile & onboarding flag | `{ user: UserProfile, onboardingComplete: boolean }` |
| `POST` | `/api/users/profile` | Authenticated | Completes onboarding by reserving a username | `{ user: UserProfile, onboardingComplete: true }` |
| `POST` | `/api/rooms` | Authenticated | Creates a new room; user becomes creator & host | `{ room: RoomDTO }` (Returns generated 6-char `roomCode`) |
| `GET` | `/api/rooms/:roomCode` | Authenticated | Retrieves room metadata, host data, and member list | `{ room: RoomDTO }` |
| `POST` | `/api/rooms/:roomCode/join` | Authenticated | Enrolls user as a permanent room member | `{ room: RoomDTO }` |
| `POST` | `/api/rooms/:roomCode/leave` | Authenticated | Removes user from permanent room membership | `{ success: true }` |
| `GET` | `/api/music/search` | Authenticated | Searches YouTube for music and video tracks | `{ results: YouTubeSearchResult[] }` |
| `GET` | `/api/music/video` | Authenticated | Resolves pasted YouTube URL or ID to playable track | `{ result: YouTubeSearchResult }` |

<br/>

---

## 💾 Database Schema

SyncD relies on **Neon Serverless PostgreSQL** managed via **Prisma ORM**. The data model enforces strong relational integrity, unique room codes, and cascading constraints.

```prisma
datasource db {
  provider = "postgresql"
}

model User {
  id                   String       @id @default(cuid())
  clerkUserId          String       @unique @map("clerk_user_id")
  username             String       @unique
  createdAt            DateTime     @default(now()) @map("created_at")
  updatedAt            DateTime     @updatedAt @map("updated_at")

  hostedRooms          Room[]       @relation("RoomHost")
  playbackUpdatedRooms Room[]       @relation("RoomPlaybackUpdater")
  memberships          RoomMember[]
  messages             Message[]

  @@map("users")
}

model Room {
  id                  String       @id @default(cuid())
  roomCode            String       @unique @map("room_code")
  hostUserId          String       @map("host_user_id")
  currentVideoId      String?      @map("current_video_id")
  currentTitle        String?      @map("current_title")
  currentThumbnailUrl String?      @map("current_thumbnail_url")
  currentDuration     Float?       @map("current_duration")
  isPlaying           Boolean      @default(false) @map("is_playing")
  playbackPosition    Float        @default(0) @map("playback_position")
  playbackUpdatedAt   DateTime?    @map("playback_updated_at")
  playbackUpdatedById String?      @map("playback_updated_by")
  createdAt           DateTime     @default(now()) @map("created_at")
  updatedAt           DateTime     @updatedAt @map("updated_at")

  host                User         @relation("RoomHost", fields: [hostUserId], references: [id], onDelete: Restrict)
  playbackUpdatedBy   User?        @relation("RoomPlaybackUpdater", fields: [playbackUpdatedById], references: [id], onDelete: SetNull)
  members             RoomMember[]
  messages            Message[]

  @@index([hostUserId], map: "rooms_host_user_id_idx")
  @@map("rooms")
}

model RoomMember {
  roomId   String   @map("room_id")
  userId   String   @map("user_id")
  joinedAt DateTime @default(now()) @map("joined_at")

  room     Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user     User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@id([roomId, userId])
  @@index([userId], map: "room_members_user_id_idx")
  @@map("room_members")
}

model Message {
  id        String   @id @default(cuid())
  roomId    String   @map("room_id")
  userId    String   @map("user_id")
  content   String
  createdAt DateTime @default(now()) @map("created_at")

  room      Room     @relation(fields: [roomId], references: [id], onDelete: Cascade)
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([roomId, createdAt], map: "messages_room_id_created_at_idx")
  @@index([userId], map: "messages_user_id_idx")
  @@map("messages")
}
```

<br/>

---

## ⚡ Quick Start

### Prerequisites

| Tool | Minimum Version | Note |
| :--- | :--- | :--- |
| **Node.js** | `v20.x` or `v22.x` | Runtime environment for server and client tooling |
| **npm** / **pnpm** | `v10.x+` | Package manager |
| **PostgreSQL / Neon** | `v15+` | Serverless PostgreSQL database with connection pooling |
| **Clerk Account** | Free tier | Provides OAuth, JWT authentication, and user identity |
| **YouTube Data API v3** | Google Cloud Console | Server-side API key for music queries |

<br/>

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/syncd.git
cd syncd
```

<br/>

### 2. Configure Environment Variables

Create environment configuration files for both the backend server and frontend client:

#### Server Configuration (`server/.env`)
```env
PORT=5000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# Neon / PostgreSQL Database URL
DATABASE_URL="postgresql://user:password@ep-cool-sample.us-east-2.aws.neon.tech/syncd?sslmode=require"

# Clerk Authentication Secrets
CLERK_PUBLISHABLE_KEY="pk_test_..."
CLERK_SECRET_KEY="sk_test_..."

# Google Cloud YouTube Data API Key
YOUTUBE_API_KEY="AIzaSy..."
```

#### Client Configuration (`client/.env`)
```env
VITE_API_BASE_URL="http://localhost:5000/api"
VITE_CLERK_PUBLISHABLE_KEY="pk_test_..."
```

<br/>

### 3. Install Dependencies & Migrate Database

```bash
# 1. Install root, server, and client dependencies
npm install

# 2. Setup Server and Database
cd server
npm install
npm run db:generate
npm run db:migrate

# 3. Setup Client
cd ../client
npm install
```

<br/>

### 4. Run Development Servers

Run both servers concurrently in separate terminal windows:

```bash
# Terminal 1 — Start Backend Express & Socket.IO Server (Port 5000)
cd server
npm run dev

# Terminal 2 — Start Frontend React 19 Client (Port 5173)
cd client
npm run dev
```

Visit [`http://localhost:5173`](http://localhost:5173) in your browser to start listening together.

<br/>

---

## ⚙️ Configuration & Environment

<details>
<summary><b>🛠️ Backend Server Environment Variables (<code>server/.env</code>)</b></summary>

<br/>

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Number | `5000` | Port on which the Express and Socket.IO server listens |
| `NODE_ENV` | String | `development` | Runtime environment (`development` or `production`) |
| `CORS_ORIGIN` | String | `http://localhost:5173` | Comma-separated allowed CORS origins |
| `DATABASE_URL` | String | `""` | Connection string for Neon/PostgreSQL database |
| `CLERK_PUBLISHABLE_KEY` | String | `""` | Clerk public key for client integration |
| `CLERK_SECRET_KEY` | String | `""` | Clerk secret key used by backend to verify session tokens |
| `YOUTUBE_API_KEY` | String | `""` | Google Cloud API key for querying YouTube Data API v3 |

</details>

<details>
<summary><b>💻 Frontend Client Environment Variables (<code>client/.env</code>)</b></summary>

<br/>

| Variable | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `VITE_API_BASE_URL` | String | `http://localhost:5000/api` | Base URL targeting the backend Express REST API |
| `VITE_CLERK_PUBLISHABLE_KEY` | String | `""` | Clerk publishable key for client-side authentication widgets |

</details>

<br/>

---

## 📂 Directory Structure

<details>
<summary><b>📁 Explore Full Project Directory Tree</b></summary>

<br/>

```
Syncd/
├── 📁 client/                         # Frontend presentation layer (React 19 + Vite 8)
│   ├── 📁 public/                     # Static brand assets & SVG iconography
│   │   ├── 📄 favicon.svg             # Multi-bar equalizer favicon mark
│   │   └── 📄 icons.svg               # SVG sprite definitions
│   ├── 📁 src/                        # Client source code
│   │   ├── 📁 assets/                 # Local media assets
│   │   ├── 📁 components/             # Reusable UI & Feature components
│   │   │   ├── 📁 landing/            # Landing page sections (Hero, Features, Showcase)
│   │   │   ├── 📁 ui/                 # Atomic design controls (Button, Card, Avatar, Equalizer)
│   │   │   ├── 📄 AuthStatusScreen.tsx# Full-page auth error & retry screen
│   │   │   ├── 📄 ChatPanel.tsx       # Live room chat panel with auto-scroll management
│   │   │   ├── 📄 MusicSearch.tsx     # YouTube search query input & video link resolver
│   │   │   ├── 📄 ProtectedRoute.tsx  # Auth & Onboarding route guards
│   │   │   └── 📄 YouTubePlayer.tsx   # Synchronized YouTube iframe container
│   │   ├── 📁 config/                 # Environment configuration loader
│   │   │   └── 📄 env.ts              # API & Socket URL configurations
│   │   ├── 📁 hooks/                  # Custom React reactive hooks
│   │   │   ├── 📄 useCurrentUser.ts   # Cached user profile consumer hook
│   │   │   ├── 📄 useRoomSocket.ts    # Socket.IO lifecycle, presence, chat & playback state
│   │   │   └── 📄 useYouTubePlayer.ts # Low-level YouTube IFrame API control hook
│   │   ├── 📁 pages/                  # Page-level route views
│   │   │   ├── 📄 Home.tsx            # User dashboard & Room creator/joiner
│   │   │   ├── 📄 Landing.tsx         # High-conversion marketing landing page
│   │   │   ├── 📄 Onboarding.tsx      # Username creation wizard
│   │   │   ├── 📄 Room.tsx            # Two-column synchronized listening lounge
│   │   │   └── 📄 RootGuard.tsx       # Gateway session router
│   │   ├── 📁 providers/              # React context providers
│   │   │   └── 📄 CurrentUserProvider.tsx # Shared single-fetch user profile context
│   │   ├── 📁 services/               # HTTP client & TypeScript interfaces
│   │   │   ├── 📄 api.ts              # Fetch wrappers for /api/* REST endpoints
│   │   │   └── 📄 types.ts            # Client-side domain and protocol type definitions
│   │   ├── 📄 App.tsx                 # Root application routes & Clerk appearance theme
│   │   ├── 📄 index.css               # Tailwind CSS v4 design tokens & keyframes
│   │   └── 📄 main.tsx                # Client entrypoint with ClerkProvider
│   ├── 📄 package.json                # Frontend dependencies & Vite scripts
│   └── 📄 vite.config.ts              # Vite configuration with React Compiler plugin
├── 📁 server/                         # Backend real-time & REST API (Node.js + Express)
│   ├── 📁 prisma/                     # Database ORM definition
│   │   ├── 📁 migrations/             # SQL schema migrations
│   │   └── 📄 schema.prisma           # Prisma models (User, Room, RoomMember, Message)
│   ├── 📁 src/                        # Backend TypeScript sources
│   │   ├── 📁 config/                 # Server environment variables & Prisma client
│   │   │   ├── 📄 db.ts               # Prisma client initialization with pg adapter
│   │   │   └── 📄 env.ts              # Typed environment variable loader
│   │   ├── 📁 middleware/             # Express middlewares
│   │   │   ├── 📄 errorHandler.ts     # Centralized error handling & 404 responses
│   │   │   └── 📄 requireAuth.ts      # Clerk authentication enforcement middleware
│   │   ├── 📁 modules/                # Feature-based domain modules
│   │   │   ├── 📁 messages/           # Chat persistence & 500-char validation
│   │   │   ├── 📁 music/              # YouTube search & URL parsing controllers
│   │   │   ├── 📁 playback/           # Host-authoritative playback services
│   │   │   ├── 📁 rooms/              # Room creation, code validation & membership
│   │   │   └── 📁 users/              # User profile retrieval & username onboarding
│   │   ├── 📁 routes/                 # Express API router aggregator
│   │   │   └── 📄 index.ts            # Mounts /api routes
│   │   ├── 📁 sockets/                # Real-time WebSocket handlers
│   │   │   ├── 📄 index.ts            # Socket.IO server, JWT middleware & event dispatchers
│   │   │   ├── 📄 presence.types.ts   # Real-time presence type declarations
│   │   │   └── 📄 presenceStore.ts    # In-memory ephemeral socket presence store
│   │   ├── 📁 utils/                  # Shared backend utilities
│   │   │   ├── 📄 logger.ts           # Structured logging utility
│   │   │   └── 📄 roomCode.ts         # 6-character room code generator
│   │   ├── 📄 app.ts                  # Express application setup & middleware chain
│   │   └── 📄 server.ts               # HTTP & Socket.IO server entrypoint (Port 5000)
│   ├── 📄 package.json                # Backend dependencies & Prisma scripts
│   └── 📄 tsconfig.json               # Backend TypeScript configuration
├── 📁 docs/                           # Architecture documentation & phase logs
│   ├── 📄 ARCHITECTURE.md             # System architecture & boundary definitions
│   └── 📄 CURRENT_STATE.md            # Detailed phase completion changelog & limitations
├── 📄 AGENTS.md                       # AI pairing & architectural conventions
├── 📄 render.yaml                     # Render.com deployment manifest for syncd-api
└── 📄 package.json                    # Workspace root scripts
```

</details>

<br/>

---

## 🗺️ Roadmap

- [x] **Phase 1: Foundation & Authentication**
  - [x] Clerk JWT integration on Express backend and React frontend
  - [x] PostgreSQL & Neon database provisioning with Prisma ORM
  - [x] Base schema migrations for Users, Rooms, Members, and Messages
- [x] **Phase 2: User Onboarding & Persistence**
  - [x] Unique username reservation workflow and validation
  - [x] Single-fetch `CurrentUserProvider` caching to prevent route race conditions
  - [x] Full error fallback screens with retry triggers
- [x] **Phase 3: Room Lifecycle & Membership**
  - [x] Unique 6-character room code generation
  - [x] Atomic room creation (creator becomes initial host and first member)
  - [x] Room joining, detail queries, and membership exit flows
- [x] **Phase 4: Real-Time Presence Gateway**
  - [x] Socket.IO connection authenticated via Clerk JWT handshake
  - [x] In-memory presence store supporting multi-tab connections per user
  - [x] Live presence broadcasts on member join, leave, and disconnect
- [x] **Phase 5: YouTube Music & Video Integration**
  - [x] Secure server-side YouTube Data API v3 proxy
  - [x] Universal video URL resolver (Shorts, Watch, Embeds, youtu.be)
  - [x] YouTube IFrame player mounting and error translation
- [x] **Phase 6: Server-Authoritative Playback Synchronization**
  - [x] Server playhead calculations: `playbackPosition + (now - playbackUpdatedAt)`
  - [x] Strict host-only authorization for track changes, play, pause, and seek
  - [x] Client-side 5-second drift monitoring with auto-reseek past 2 seconds
  - [x] Echo-loop suppression on remote state application
- [x] **Phase 7: Real-Time Chat & Room UI Refinement**
  - [x] Persist-before-broadcast room messaging with 500-char content validation
  - [x] Chat history delivery bundled into the initial `room:join` socket ack
  - [x] Responsive two-column lounge layout (left: video/controls, right: presence/chat)
  - [x] Independent chat scrolling with "↓ New messages" pill for unread messages
- [ ] **Phase 8: Shared Media Queue**
  - [ ] Upvote-based collaborative queueing system
  - [ ] Automatic track advancement when the active video ends
- [ ] **Phase 9: Host Transfer & Collaborative DJ Mode**
  - [ ] Host relinquishment / reassignment upon host disconnect
  - [ ] Free-for-all listening mode where any member can control playback
- [ ] **Phase 10: Interactive Reactions & Production Scaling**
  - [ ] Ephemeral audio soundboard and floating emoji bursts
  - [ ] Redis Adapter for multi-instance Socket.IO cluster scaling

<br/>

---

## 🚀 Recent Updates

### 🌟 Phase 7 Complete — Real-Time Chat & Room UI Refinement
* **💬 Integrated Room Chat Engine:**
  * Added instant real-time messaging using Socket.IO events (`chat:send` → `chat:new`).
  * Enforced a **persist-before-broadcast** guarantee: messages are committed to PostgreSQL before emission, preventing ghost messages across clients.
  * History delivery rides the `room:join` socket ack—the latest 50 messages arrive seamlessly alongside playback and presence snapshots on connection.
* **📱 Responsive Lounge Architecture:**
  * Redesigned `/room/:roomCode` into a balanced two-column desktop layout (`lg+`), stacking video & controls on the left with live presence & chat on the right.
  * Internal independently scrolling chat viewport with unread pill indicators (`↓ New messages`).
  * Instant room code clipboard copying with visual toast feedback.

### 🎚️ Phase 6 Complete — Synchronized Playback Engine
* **⏱️ Server-Authoritative Playhead:**
  * Playback status, position, and timestamps persist directly to the `Room` row in PostgreSQL.
  * Client playhead calculation accounts for transmission latency without storing per-second database writes.
* **🎯 Sub-2-Second Drift Correction:**
  * 5-second polling interval detects playback divergence and automatically reseeks client players into tight synchrony.

<br/>

---

<div align="center">

**Synchronized music, seamless presence, and warm cinematic vibes for listening together.**

<sub>Crafted with precision using React 19, Vite, Tailwind CSS v4, Socket.IO, Express 5, and Prisma.</sub>

</div>
