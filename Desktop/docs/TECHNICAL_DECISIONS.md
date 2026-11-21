# SyncD Desktop — Technical Decision Records (ADRs)

## Overview & Index

This document formalizes the architectural decisions made for SyncD Desktop. Every decision documents the context, alternatives considered, decision rationale, trade-offs, and compliance with the master engineering principles.

- [ADR-01: Framework Selection — Tauri 2 vs. Electron](#adr-01-framework-selection--tauri-2-vs-electron)
- [ADR-02: Native Audio Engine — Symphonia + CPAL](#adr-02-native-audio-engine--symphonia--cpal)
- [ADR-03: Local Persistence & Search — SQLite + FTS5 in WAL Mode](#adr-03-local-persistence--search--sqlite--fts5-in-wal-mode)
- [ADR-04: Audio Tag Extraction — Lofty Crate](#adr-04-audio-tag-extraction--lofty-crate)
- [ADR-05: Desktop UI State Architecture — Zustand](#adr-05-desktop-ui-state-architecture--zustand)
- [ADR-06: Desktop Authentication — OAuth PKCE via Native Keyring](#adr-06-desktop-authentication--oauth-pkce-via-native-keyring)
- [ADR-07: Social Listening Model — Shared Local-Track Reconciliation](#adr-07-social-listening-model--shared-local-track-reconciliation)
- [ADR-08: Windows Storage Topology — Desktop-Anchored SyncD Root](#adr-08-windows-storage-topology--desktop-anchored-syncd-root)
- [ADR-09: Complete Ban on Artificial Intelligence Features](#adr-09-complete-ban-on-artificial-intelligence-features)

---

### ADR-01: Framework Selection — Tauri 2 vs. Electron
- **Status:** Approved
- **Context:** SyncD Desktop requires a native desktop application with modern Web UI capabilities, tight OS integration (Windows media keys, low-level audio, file indexing), and minimal resource overhead.
- **Decision:** Select **Tauri 2** (Rust host process + OS Webview renderer).
- **Alternatives Considered:**
  - *Electron:* Bundles an entire Chromium browser and Node.js runtime. Rejected due to high RAM overhead (200MB+ idle), 150MB+ installer sizes, and garbage collection pauses affecting audio processing.
  - *Flutter / Qt C++:* Lacks the rapid UI iteration and ecosystem parity with the existing React-based SyncD Web client.
- **Consequences:** Installer size drops from $>150\text{ MB}$ to $<15\text{ MB}$. Idle memory is $<60\text{ MB}$. Requires writing native services in Rust, which perfectly aligns with our high-performance audio and metadata indexing requirements.

---

### ADR-02: Native Audio Engine — Symphonia + CPAL
- **Status:** Approved
- **Context:** The application needs a dedicated, reliable audio engine supporting MP3, FLAC, WAV, AAC, Vorbis, and Opus with sub-30ms seek times, exact duration calculations, and device switching.
- **Decision:** Build an in-house Rust audio subsystem using **Symphonia** for stream decoding and **CPAL** for low-latency hardware stream management (WASAPI on Windows).
- **Alternatives Considered:**
  - *HTML5 `<audio>` in Webview:* Subject to Webview lifecycle interruptions, memory bloat, inconsistent codec support, and inability to maintain background playback during heavy DOM tasks. Banned.
  - *Rodio:* A high-level wrapper over CPAL. Lacks fine-grained control over streaming ring buffers and precision seek packet alignment.
  - *FFmpeg C-bindings:* Complex build toolchain, large binary size, license risks (LGPL/GPL), and potential C memory safety vulnerabilities.
- **Consequences:** 100% pure Rust audio pipeline. Zero C dependencies. Strict bounded ring buffer memory ($<1\text{ MB}$ per stream).

---

### ADR-03: Local Persistence & Search — SQLite + FTS5 in WAL Mode
- **Status:** Approved
- **Context:** Fast indexing and instant searching across 10,000 to 100,000 personal tracks offline. Must support complex multi-criteria filters (artist, album, year, genre) and full-text search.
- **Decision:** Use **SQLite 3** via the `rusqlite` crate with **WAL (Write-Ahead Logging)** mode and **FTS5** full-text search extension enabled.
- **Alternatives Considered:**
  - *Embedded Key-Value (RocksDB / Sled):* Lacks structured relational queries and FTS indexing.
  - *DuckDB:* Optimized for OLAP column-scans, but higher idle memory footprint and less optimal for single-record UI reads and incremental writes.
- **Consequences:** ACID-compliant, robust file format. Sub-15ms search across 50k tracks. Zero network dependency for personal music management.

---

### ADR-04: Audio Tag Extraction — Lofty Crate
- **Status:** Approved
- **Context:** Indexing thousands of music files requires parsing ID3v1, ID3v2, Vorbis Comments, and MP4 atoms quickly without crashing on corrupt metadata.
- **Decision:** Use **Lofty** (pure Rust audio tagging library).
- **Alternatives Considered:**
  - *Id3 / Metaflac crates:* Fragmented; requires different crates for different formats with inconsistent APIs.
  - *TagLib (C++):* Requires C++ compiler toolchain on Windows, difficult cross-compilation.
- **Consequences:** Uniform metadata API across MP3, FLAC, OGG, M4A, WAV. Lazy embedded artwork extraction prevents memory exhaustion during initial indexing.

---

### ADR-05: Desktop UI State Architecture — Zustand
- **Status:** Approved
- **Context:** Managing player state, library cache, room presence, chat, and queue with predictable re-renders and minimal boilerplate.
- **Decision:** Standardize on **Zustand** stores with TypeScript discriminated unions.
- **Alternatives Considered:**
  - *Redux Toolkit:* Excessive boilerplate and indirection for a desktop client.
  - *React Context:* Causes unnecessary re-renders across the component tree when high-frequency updates (e.g. 10Hz playhead ticks) occur.
- **Consequences:** Granular selectors allow the playhead to tick smoothly without re-rendering the track list or navigation sidebar.

---

### ADR-06: Desktop Authentication — OAuth PKCE via Native Keyring
- **Status:** Approved
- **Context:** SyncD Desktop must authenticate against the existing Clerk user pool without compromising user security or violating Clerk terms of service.
- **Decision:** Desktop initiates OAuth login in the default system browser, receives the callback via loopback HTTP (`http://127.0.0.1:<port>/callback`) or custom URI scheme (`syncd://auth`), verifies tokens with the backend, and securely persists credentials in the **Windows Credential Manager** via the `keyring` crate.
- **Alternatives Considered:**
  - *Storing tokens in `settings.json` or plain `localStorage`:* Unacceptable security vulnerability.
  - *Embedding Webview login form:* Discouraged by modern OAuth providers due to phishing risks and lack of WebAuthn/passkey support.
- **Consequences:** Completely secure credential storage backed by Windows DPAPI. Seamless single sign-on experience.

---

### ADR-07: Social Listening Model — YouTube-Driven Social Rooms & Local Audio Separation
- **Status:** Approved (Confirmed by User)
- **Context:** Social rooms coordinate listening across Web and Desktop users. We needed to clarify how room tracks are represented and played.
- **Decision:** Social rooms use **YouTube-driven playback** (the existing backend YouTube Data API and video ID protocol). There is **no local video playback or local video streaming**. Users in social rooms play and synchronize video/audio via YouTube (matching the Web client). The native Rust playback engine (Symphonia + CPAL) is dedicated to the user's high-fidelity personal local music library.
- **Consequences:** 100% interoperability between Desktop and Web in social rooms without requiring backend schema changes or local file distribution. Clean separation between personal offline music and social room listening.

---

### ADR-08: Storage Topology — User Installation Directory Anchor
- **Status:** Approved (Confirmed by User)
- **Context:** The location of application data, indexes, and logs must be deterministic, avoid hardcoded defaults, and respect user installation preferences.
- **Decision:** Storage is anchored directly to **where the user installs the application** (the application installation directory or user-selected path at setup/first run). There is **no hardcoded default** to `%USERPROFILE%\Desktop\SyncD`. The application dynamically resolves its operational root from its executable/install directory or explicit user configuration.
- **Consequences:** Avoids OneDrive sync lock conflicts on the Windows Desktop. Keeps user data and application state co-located with the installation as configured by the user.

---

### ADR-09: Complete Ban on Artificial Intelligence Features
- **Status:** Approved
- **Context:** Master prompt strictly prohibits AI features or dependencies.
- **Decision:** No AI recommendation engines, natural language assistants, synthetic playlist generators, or machine-learning audio filters will ever be included in SyncD Desktop.
- **Consequences:** Clean, deterministic, private codebase focused purely on user agency and music fidelity.

