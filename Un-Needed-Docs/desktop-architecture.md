# Plan: SyncD Desktop Architecture & Implementation

> Project Type: DESKTOP (Tauri 2 + Rust + React/Vite)  
> Status: Milestones 0 through 7 Completed (Fully Implemented & Hardened)

---

## 1. Overview & Vision
SyncD Desktop is a high-performance, native desktop music player and social listening platform engineered for Windows (with cross-platform architecture). It unifies personal local music library management, low-latency native audio playback, and real-time social listening synchronized with the existing SyncD Web client and authoritative Node.js/PostgreSQL backend.

---

## 2. Success Criteria
- [x] Comprehensive repository audit of Web client, server, Prisma schema, and CI completed (Milestone 0).
- [x] All 8 master engineering specifications created in `Desktop/docs/` (Milestone 0).
- [x] CI workflows migrated to root `.github/workflows/` with path filtering.
- [x] Root `.gitignore` created preserving Web rules and adding Desktop/Rust rules.
- [x] Working Tauri 2 + React 19 + TypeScript + Vite + Tailwind desktop foundation with SQLite WAL + FTS5 migrations (Milestone 1).
- [x] T3 Code-inspired desktop shell: 3-column resizable layout, TitleBar, Right Drawer, Bottom Player, Accessible UI primitives, and Feedback Toast/Error/Empty systems (Milestone 2).
- [x] Bounded background library scanner with Lofty metadata extraction and SQLite FTS5 search (Milestone 3).
- [x] Native Rust audio engine using Symphonia + CPAL with sub-30ms seek, zero-allocation audio callbacks, and lock-free `rtrb` ring buffer (Milestone 4).
- [x] Social room integration matching backend Socket.IO protocols, live presence, 30s host transfer grace period, and room chat (Milestone 5).
- [x] Merged Milestone 6 & 7: Social room YouTube synchronized playback with bounded drift reconciler, echo suppression, local lossless linkage, release hardening, and UI overhaul hiding developer internals (Milestones 6+7).
- [x] Zero AI features or dependencies.
- [x] Web application remains 100% operational with zero regressions.

---

## 3. Tech Stack Matrix
- **Desktop Framework:** Tauri 2 (frameless borderless window with custom chrome)
- **Native Host:** Rust 1.75+ (CPAL, Symphonia, Lofty, Rusqlite, Rayon, Base64, Windows SMTC)
- **Renderer Frontend:** React 19, TypeScript (Strict), Vite 6, Tailwind CSS v4, Zustand
- **Local Persistence:** SQLite 3 in WAL mode + FTS5 full-text search (anchored to user install directory)
- **Social Backend:** Existing Express, Socket.IO, Prisma, PostgreSQL (`Web/server/`)
- **Social Room Playback:** YouTube-driven video/audio playback matching existing backend protocols with 2.0s drift reconciliation
- **Authentication:** Existing Clerk identity system via session tokens & secure storage

---

## 4. Directory Layout & Boundaries
- `Web/`: Existing application (client, server, docs) - untouched.
- `Desktop/`: Standalone native desktop application with separate `package.json`, `src/`, `src-tauri/`, and `docs/`.
- `.github/workflows/`:
  - `web-ci.yml`: Validates Web client & server when files under `Web/**` change.
  - `desktop-ci.yml`: Validates Desktop types, lint, and Rust clippy/tests when files under `Desktop/**` change.
- `.gitignore`: Root repository ignore rules.

---

## 5. Milestone Completion Summary
1. **Milestone 0: Audit & Architecture Documentation** — COMPLETED (8 master architecture docs in `Desktop/docs/`)
2. **Milestone 1: Desktop Foundation** — COMPLETED (Tauri 2, SQLite WAL, thread-safe AppState)
3. **Milestone 2: Design System & UI Shell** — COMPLETED (T3 Code inspiration, 3-column shell, bottom player, feedback primitives)
4. **Milestone 3: Local Library & Scanner** — COMPLETED (Lofty tag extraction, background incremental scanner, FTS5 prefix search)
5. **Milestone 4: Native Playback Engine** — COMPLETED (Symphonia decoders, CPAL WASAPI, lock-free `rtrb` ring buffer)
6. **Milestone 5: Social Integration** — COMPLETED (Clerk auth store, REST client, Socket.IO real-time client, presence, room chat, queue)
7. **Merged Milestones 6 + 7: Synchronized Playback, Release Hardening & UI Overhaul** — COMPLETED:
   - YouTube room player integration with 5-second drift evaluation and 2000ms echo suppression.
   - Local lossless track linkage matching social room tracks to pristine local files.
   - UI Overhaul removing all developer scaffolding (raw URLs, JWT paste boxes, SQLite WAL debug badges, duplicate title bars).
   - Frameless native window chrome with custom window controls.
   - Polished consumer-grade preferences and playback controls adhering strictly to the Purple Ban.
