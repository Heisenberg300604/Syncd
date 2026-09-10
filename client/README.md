# SyncD — Frontend (`client`)

> The modern, high-aesthetic web client for **SyncD** — a real-time social music-listening application.  
> Built with **React 19**, **Vite**, **TypeScript**, **Tailwind CSS v4**, **Socket.IO**, and **Clerk**.

---

## Features

- **Synchronized Music Player**: Embedded YouTube IFrame player with server-authoritative timekeeping, automatic 5s / 2s drift correction, and echo-loop suppression.
- **Music Search & Universal URL Resolver**: In-room music search powered by YouTube Data API v3, plus direct resolution for standard YouTube URLs, Shorts, embed links, and `youtu.be` shortcuts.
- **Live Room Presence**: Ephemeral real-time member roster with multi-tab awareness and connection resilience.
- **Real-Time Persistent Chat**: In-room messaging with 500-character safety caps, smart auto-scroll anchoring, and unread indicator pills.
- **Rich Cinematic Aesthetics**: Dark-mode theme with warm amber highlights, WebGL background shaders (`FloatingLines` via OGL), and glassmorphism.
- **Zero-Friction Authentication**: Clerk-powered OAuth (Google) and magic links with single-session `/me` caching via `CurrentUserProvider`.

---

## Tech Stack

| Category | Technology |
| :--- | :--- |
| **Framework** | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **Build Tool** | [Vite 8](https://vite.dev/) with React Compiler & Babel Preset |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) (`@theme` tokens) |
| **Routing** | [React Router 7](https://reactrouter.com/) |
| **Real-Time** | [Socket.IO Client](https://socket.io/) (`socket.io-client` v4) |
| **Authentication** | [Clerk React](https://clerk.com/) (`@clerk/react`) |
| **Graphics & Shaders** | [OGL](https://github.com/oframe/ogl) & [Three.js](https://threejs.org/) |
| **Icons & Typography** | [Lucide React](https://lucide.dev/), Manrope, Caveat, JetBrains Mono |

---

## Project Structure

```text
client/
├── public/                 # Static assets (favicon.svg, hero graphics)
├── src/
│   ├── assets/             # Brand marks, SVGs, background textures
│   ├── components/         # Presentation & feature components
│   │   ├── landing/        # Marketing views (Hero, Features, FinalCTA, FloatingLines)
│   │   ├── ui/             # Reusable design atoms (Button, Avatar, Logo, ScrollReveal)
│   │   ├── YouTubePlayer.tsx # Embedded player with controls & seek bar
│   │   ├── ChatPanel.tsx   # Real-time chat list & message composer
│   │   ├── MusicSearch.tsx # Search modal & link paste resolver
│   │   └── ProtectedRoute.tsx # Route barrier for authenticated users
│   ├── config/             # Environment configuration (env.ts)
│   ├── hooks/              # Custom domain hooks
│   │   ├── useCurrentUser.ts     # Access cached profile context
│   │   ├── useRoomSocket.ts      # WebSocket connection, presence & chat
│   │   └── useYouTubePlayer.ts   # Player lifecycle, drift detection & echo locks
│   ├── pages/              # Primary route views
│   │   ├── Landing.tsx     # Product marketing page
│   │   ├── Home.tsx        # Dashboard (Create Room / Join Room)
│   │   ├── Room.tsx        # 2-column room lounge (player + chat + roster)
│   │   ├── Onboarding.tsx  # First-time username selection
│   │   └── RootGuard.tsx   # Root session dispatcher
│   ├── providers/          # React Context providers
│   │   ├── CurrentUserProvider.tsx # Shared /me cache & onboarding status
│   │   └── currentUserContext.ts
│   ├── services/           # Typed API communication
│   │   ├── api.ts          # Authenticated fetch client
│   │   └── types.ts        # Shared TypeScript DTOs
│   ├── utils/              # Time formatters, helper functions
│   ├── App.tsx             # Route definitions & layout wrappers
│   ├── index.css           # Global Tailwind tokens, animations & resets
│   └── main.tsx            # App bootstrap & ClerkProvider
├── .env.example            # Environment variable template
├── vite.config.ts          # Vite build & plugin configuration
└── package.json            # Client dependencies & scripts
```

---

## Getting Started

### 1. Prerequisites

- **Node.js**: v20.x or higher
- **SyncD Server**: Running locally on port `5000` (or accessible remotely)
- **Clerk Account**: Active Clerk application with a Publishable Key

### 2. Environment Setup

Create a `.env` file in `client/` by copying the example:

```bash
cp .env.example .env
```

Configure the environment variables:

```ini
# Backend API Base URL
VITE_API_BASE_URL=http://localhost:5000/api

# Clerk Authentication Publishable Key
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_clerk_key_here
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Run Development Server

```bash
npm run dev
```

The application will be accessible at `http://localhost:5173`.

---

## Available Scripts

| Script | Command | Description |
| :--- | :--- | :--- |
| `npm run dev` | `vite` | Starts the local Vite development server with Hot Module Replacement (HMR). |
| `npm run build` | `tsc -b && vite build` | Type-checks with TypeScript and compiles the production bundle into `dist/`. |
| `npm run preview`| `vite preview` | Serves the production build locally for verification. |
| `npm run lint` | `eslint .` | Runs ESLint across all TypeScript and React files. |

---

## Core Client Architecture

### 1. User Session Caching (`CurrentUserProvider`)
Rather than refetching `/me` on every route transition:
- Current user profile is fetched **once** upon initial sign-in and cached in memory.
- If `onboardingComplete: false`, the user is redirected to `/onboarding`.
- Profile creation seeds the context directly from the mutation response, preventing extra round trips and race conditions.

### 2. Real-Time Room Coordination (`useRoomSocket`)
Encapsulates all WebSocket communication:
- Passes the Clerk session token during the Socket.IO handshake.
- Dispatches `room:join` and receives initial presence, playback state, and recent chat history in a single acknowledgment.
- Subscribes to `presence:update`, `playback:update`, and `chat:new` events.
- Gracefully re-syncs state on reconnects without page reloads.

### 3. Playback Synchronization Engine (`useYouTubePlayer`)
Controls the YouTube IFrame player with zero jitter:
- **Mathematical Playhead Derivation**: Derives current playback position locally using `playbackPosition + (Now - playbackUpdatedAt)`.
- **Drift Correction Loop**: Checks alignment every 5 seconds; if the local player deviates by more than 2 seconds, it silently seeks into place.
- **Echo-Loop Suppression**: Suppresses local playback event listeners when applying remote updates to avoid circular broadcast storms.

---

## Design System & Styling

SyncD uses **Tailwind CSS v4** with unified `@theme` tokens in `src/index.css`:

```css
@theme {
  /* Surfaces */
  --color-canvas: #0a0908;
  --color-surface: #12100e;
  --color-raised: #181512;
  --color-overlay: #201b16;

  /* Accent Palette */
  --color-accent: #f7a23b;
  --color-accent-hi: #f97316;
  --color-accent-lo: rgba(247, 162, 59, 0.12);

  /* Status Colors */
  --color-online: #34d399;
  --color-warning: #fbbf24;
  --color-danger: #f87171;
}
```

---

## Deployment

The client is an SPA and can be deployed to any static host (Vercel, Cloudflare Pages, Netlify):

1. **SPA Rewrites**: Ensure all non-asset requests rewrite to `/index.html` (configured in `vercel.json`).
2. **Environment Variables**: Set `VITE_API_BASE_URL` (pointing to production backend) and `VITE_CLERK_PUBLISHABLE_KEY` in your hosting dashboard.
