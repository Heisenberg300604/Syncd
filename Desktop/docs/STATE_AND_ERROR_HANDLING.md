# SyncD Desktop — Mandatory UI State & Error Handling Matrix

## 1. Executive Philosophy & Rules

In SyncD Desktop, **state and error handling is an architectural guarantee, not an afterthought.**

### Strict Implementation Rules
1. **No Indefinite Spinners:** Every asynchronous operation must have a timeout, failure branch, or cancellation handle.
2. **Discriminated Unions Over Scattered Booleans:** Contradictory states like `{ isLoading: true, isError: true }` are banned. All state containers must be modeled using strict TypeScript discriminated unions.
3. **Preserve User Intent:** Never wipe user form inputs, search filters, or partial draft messages when an operation fails.
4. **Actionable, Non-Generic Error Copy:** An error message must explain *what happened* and *what the user can do about it* (e.g., "Audio device 'Realtek Digital Output' was unplugged. Switched to Default Output" instead of "Error: Device error").
5. **No Fake Progress or False Success:** Never display a completion toast or progress bar until the background task or transaction has verifiably committed.
6. **Accessible Feedback:** Every asynchronous state transition must announce its status to assistive screen readers via `aria-live="polite"` or `role="alert"`.

---

## 2. Standard State Type Definitions

```typescript
// Generic Resource State for Asynchronous Entities
export type AsyncResource<T, E = string> =
  | { status: "initial" }
  | { status: "loading"; progress?: number; cancel?: () => void }
  | { status: "success"; data: T }
  | { status: "empty"; message?: string; action?: { label: string; onClick: () => void } }
  | { status: "error"; error: E; retry?: () => void }
  | { status: "offline"; cachedData?: T }
  | { status: "partial"; data: T; missingCount: number };
```

---

## 3. Comprehensive Feature-by-Feature State Matrix

### 3.1 Library & Scanner Module

| Scenario / State | Visual Presentation | User Action & Recovery Path |
|---|---|---|
| **Initial (No Folders)** | Centered empty illustration, warm zinc card, "Add Your Music Folder" primary button. | Clicking opens native OS folder picker (`dialog.open`). |
| **Scanning in Progress** | Sub-header banner showing animated spinner, folder name, track count counter (`Indexed 1,420 tracks...`), and "Cancel" button. | User can freely navigate or listen to already indexed music. Scanner operates in bounded background pool. |
| **Scan Completed** | Banner dissolves with green checkmark pill: `Indexed 3,240 tracks in 4.2s`. Auto-dismisses in 4 seconds. | Library table updates live with new items. |
| **Partial Failure (Corrupt Files)** | Amber warning indicator on status bar: `3 files could not be read (corrupt tags or unsupported format)`. | Clicking opens diagnostic dialog listing the exact file paths and Symphonia decoder errors. |
| **Folder Unavailable (Unplugged Drive)** | Folder listed in Settings shows red warning icon: `Drive E:\ is disconnected`. Tracks remain in database but show dimmed text. | When drive is reconnected, user clicks "Check Availability" to re-verify without full re-indexing. |
| **Permission Denied** | Modal/Banner: `Access denied to folder C:\SystemMusic. Please grant read permission.` | Provides instructions to grant read access or select another folder. |
| **Search Empty Results** | Inline empty state: `No tracks found matching "pink floyd"`. Clear Search link. | Clicking "Clear Search" resets filter instantly. |
| **Search Error (Corrupt FTS5)** | Inline alert: `Search index needs repair`. | "Rebuild Index" button triggers background `REINDEX` in SQLite. |
| **Artwork Missing** | High-contrast geometric cassette placeholder with album title initials. | Never shows broken image icon or blank square. |
| **Offline Library Usage** | Normal full library browsing. Green offline indicator on status bar. | Local playback functions 100% offline without network checks. |

---

### 3.2 Native Player Module

| Scenario / State | Visual Presentation | User Action & Recovery Path |
|---|---|---|
| **No Track Selected** | Player bar visible; track title reads "No track loaded"; play button disabled; seek bar at 00:00. | Prompt text: "Select a track from your library to begin listening". |
| **Loading Track** | Seek bar pulses with subtle amber glow; title shows new track name; play button shows loading ring. | Automatic transition to `Playing` once Symphonia buffers initial 500ms. |
| **Playing** | Play button displays `Pause` icon; live seek head advances at 60fps; animated equalizer bars beside artwork. | Clicking `Pause` or pressing `Space` immediately pauses audio. |
| **Paused** | Play button displays `Play` icon; equalizer bars freeze; seek head maintains exact position. | Pressing `Space` resumes playback instantly with zero latency. |
| **Seeking** | User drags seek head: preview time tooltip follows mouse; audio smoothly mutes until mouse release. | Audio seeks to exact sample and resumes playing in $< 30\text{ms}$. |
| **Unsupported Format** | Toast alert: `Cannot play 'song.m4a': AAC decoder disabled or unparseable stream`. | Skips to next track in queue with a brief warning log. |
| **Output Device Detached (USB/BT)** | Playback pauses automatically. Notification: `Headphones disconnected. Switched to Realtek Speakers`. | User can click "Resume" or select preferred output device in Settings. |
| **Playback Fatal Failure** | Error banner on player bar: `Audio engine error. Failed to initialize WASAPI stream`. | "Restart Audio Engine" button unloads and reinitializes CPAL stream cleanly. |
| **Queue Empty** | Queue drawer displays clean empty state: `Queue is empty. Right-click any track or album to add it`. | Playback finishes gracefully after last track. |

---

### 3.3 Rooms Module (Social Listening)

| Scenario / State | Visual Presentation | User Action & Recovery Path |
|---|---|---|
| **Not Connected (No Auth)** | "Sign In to Access Rooms" card with benefits overview. | "Sign In" button triggers secure Clerk desktop login. |
| **Loading Rooms** | Clean zinc card skeletons with pulse animation. | Loading state expires after 10s with retry button if API fails. |
| **No Rooms Available** | "No public rooms currently active. Create one to start listening with friends!" | Primary "Create Room" button. |
| **Joining Room** | Modal overlay: `Entering room A7X9K2...` with connection status. | Times out after 8s if backend socket connection fails. |
| **Join Failed (Invalid Code)** | Inline form error below room code input: `Room "XYZ999" does not exist or has expired`. | Input preserves user-typed code with cursor placed at end. |
| **Connection Lost / Reconnecting** | Amber top banner: `Connection lost. Reconnecting to room... (Attempt 2/5)`. Player maintains local playback. | Socket.IO auto-reconnects with exponential backoff. |
| **Host Disconnected (Grace Period)** | Prominent room countdown banner: `Host disconnected. Host transfer to [alex] in 24s`. | If host returns, countdown cancels immediately. |
| **Host Transfer Completed** | Blue notice banner: `[alex] is now the room host`. | Notice can be dismissed; controls unlock for new host. |
| **Room Closed (All Left)** | Modal: `This room was closed because all participants left`. | "Back to Rooms" button returns user to Room directory. |
| **Missing Local Track** | Amber indicator on room track: `Local audio file not found for this shared track`. | "Match Local File" button opens file picker to bind track locally. |

---

### 3.4 Chat Module

| Scenario / State | Visual Presentation | User Action & Recovery Path |
|---|---|---|
| **Loading Messages** | 4-row message skeleton pulsing gently. | Messages load from `room:join` socket acknowledgment. |
| **Empty Chat** | Centered caption: `No messages yet. Say hello to the room!` | User focuses chat input. |
| **Sending Message** | Message appears optimistically in chat with dimmed text and a tiny clock icon. | Text field clears immediately to allow typing next message. |
| **Sent Successfully** | Clock icon dissolves; message takes full opacity upon server `chat:new` broadcast. | Normal reading state. |
| **Failed to Send** | Message shows red outline and warning icon: `Failed to deliver. Click to retry`. | Clicking message triggers instant resend without losing message text. |
| **Offline / Disconnected** | Chat input disabled with placeholder: `Chat unavailable while disconnected`. | Re-enables automatically upon socket reconnection. |

---

### 3.5 Settings Module

| Scenario / State | Visual Presentation | User Action & Recovery Path |
|---|---|---|
| **Saving Settings** | "Saving..." indicator on bottom action bar. | Fast asynchronous SQLite/JSON commit. |
| **Saved Successfully** | Green badge: `Settings saved` (fades out after 2s). | No user action required. |
| **Save Failed** | Red inline banner: `Failed to save preferences: Disk write error`. | "Retry Save" button. |
| **Destructive Action (Reset DB)**| Red danger modal: `Are you sure you want to rebuild the music library index? Your music files will NOT be deleted.` | Requires explicit confirmation click: "Rebuild Library". |

---

## 4. Reusable Feedback Primitives

1. `<LoadingState size="sm"|"md"|"lg" message="..." />`: Accessible spinner with minimum layout shift.
2. `<EmptyState icon={...} title="..." description="..." action={{ label, onClick }} />`: Standardized empty view.
3. `<ErrorState title="..." message="..." onRetry={...} />`: Centered or inline error panel.
4. `<OfflineBanner isOffline={boolean} />`: Sticky top-of-viewport status banner.
5. `<ConfirmDialog isOpen={...} title="..." destructive onConfirm={...} onCancel={...} />`: Keyboard-trap accessible modal for destructive actions.

