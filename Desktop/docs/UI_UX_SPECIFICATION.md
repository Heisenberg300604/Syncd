# SyncD Desktop — UI/UX Specification & Design System

## 1. Product Design Vision & T3 Code Inspiration

SyncD Desktop is designed as a focused, desktop-native music player and social hub. Its interaction philosophy draws direct inspiration from **T3 Code** (`pingdotgg/t3code`), emphasizing:

- **High-Density, Zero-Clutter Architecture:** Optimized for power users who value immediate information hierarchy, readable typography, and quick keyboard-driven navigation over ornamental animations or bloated card layouts.
- **Docked Three-Column Desktop Ergonomics:** Seamless separation of navigation (left), primary workspace (center), contextual sidebars/drawers (right), and a persistent bottom playback bar.
- **Music-Centric Visual Identity:** Album artwork, vinyl/cassette geometry, waveforms, and clean metadata take center stage.
- **Strict Brand Compliance (Purple Ban):** Fully compliant with project design guidelines. No generic purple/violet palettes. The aesthetic uses deep warm zincs, obsidian blacks, and SyncD's signature warm amber/gold accents (`#f59e0b` / `#f7a23b`).

---

## 2. Desktop Information Architecture & Layout Matrix

```text
+---------------------------------------------------------------------------------------------------------+
|                                    CUSTOM NATIVE WINDOW TITLEBAR                                        |
|  [SyncD Logo]   [ < Back ] [ > Forward ]      [ Search Library or Rooms (Ctrl+K) ]      [ - ] [ [] ] [ X ]|
+-------------------+---------------------------------------------------------+---------------------------+
|                   |                                                         |                           |
|  LEFT SIDEBAR     |                  MAIN CONTENT VIEW                      |  RIGHT CONTEXT DRAWER     |
|  (Collapsible)    |                                                         |  (Collapsible / Tabbed)   |
|                   |  - Home (Overview, Quick Jump, Activity)                |                           |
|  * Home           |  - Library (Virtual Table: Title, Artist, Album, Time)  |  [ Queue ]  [ Room Chat ] |
|  * Library        |  - Playlists (User Collections & Folder Views)          |                           |
|    - Tracks       |  - Rooms (Browse Social Rooms, Active Host Card)        |  - Dynamic Queue List     |
|    - Artists      |  - Settings (Audio Output, Folders, Account, Diagnostics|  - Participants Presence  |
|    - Albums       |                                                         |  - Real-Time Chat Stream  |
|  * Playlists      |                                                         |  - Host Action Controls   |
|  * Rooms          |                                                         |                           |
|                   |                                                         |                           |
|  --- FOLDERS ---  |                                                         |                           |
|  [+] Add Folder   |                                                         |                           |
|  * D:/Music (OK)  |                                                         |                           |
|                   |                                                         |                           |
+-------------------+---------------------------------------------------------+---------------------------+
|                                  PERSISTENT BOTTOM PLAYER BAR                                           |
| [Art] [Title]     |      [Prev] [ Play/Pause ] [Next] [Shuffle] [Repeat]    | [Vol Slider] [Room Sync]  |
|       [Artist]    |  01:24 ============================O============= 03:45 | [Queue Toggle] [Device]   |
+---------------------------------------------------------------------------------------------------------+
```

### 2.1 Panel Specifications

| Panel | Min Width | Default Width | Max Width | Behavior |
|---|---|---|---|---|
| **Left Sidebar** | `64px` (collapsed icon-only) | `220px` | `320px` | User resizable with draggable divider; can collapse to icon rail. |
| **Main Content** | `500px` | Flexible (`1fr`) | Unconstrained | Primary content region with virtualized scrolling for large libraries. |
| **Right Drawer** | `0px` (closed) | `300px` | `420px` | Toggled open via Queue button or Room Chat; resizable divider. |
| **Bottom Player**| Full Width | `84px` height | Fixed `84px` | Persistent across all route changes; contains native audio controls. |

---

## 3. Design Tokens & Visual Hierarchy

### 3.1 Color Palette (Dark Theme Default)

```css
:root {
  /* Surface & Background Tokens */
  --syncd-bg-canvas: #09090b;       /* Pure background canvas */
  --syncd-bg-surface: #121214;      /* Cards, sidebar, player background */
  --syncd-bg-elevated: #1a1a1e;     /* Popovers, dropdowns, hovered items */
  --syncd-bg-sunken: #050507;       /* Input backgrounds, sunken viewports */

  /* Border & Divider Tokens */
  --syncd-border-subtle: #202024;   /* Panel dividers, subtle outlines */
  --syncd-border-focus: #f59e0b;    /* Active focus outlines */
  --syncd-border-muted: #2e2e34;    /* Card borders */

  /* Text & Typography Tokens */
  --syncd-text-primary: #f4f4f5;    /* Headings, track titles */
  --syncd-text-secondary: #a1a1aa;  /* Artist names, table headers */
  --syncd-text-muted: #71717a;      /* Timestamps, track numbers, file formats */
  --syncd-text-disabled: #52525b;   /* Disabled button labels */

  /* Brand & Accent Tokens (Warm Amber & Gold - No Purple!) */
  --syncd-accent-primary: #f59e0b;  /* Primary buttons, seek head, active tab */
  --syncd-accent-hover: #d97706;    /* Button hover state */
  --syncd-accent-muted: rgba(245, 158, 11, 0.12); /* Selected row highlight */

  /* Semantic Feedback Tokens */
  --syncd-status-success: #10b981;  /* Room connected, file indexed */
  --syncd-status-warning: #f59e0b;  /* Host transfer countdown, high drift */
  --syncd-status-error: #ef4444;    /* Playback error, missing file, 401 */
  --syncd-status-offline: #6b7280;  /* Network disconnect, offline cached state */
}
```

### 3.2 Typography System

- **Primary UI Font:** `Inter`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif.
- **Display & Brand Font:** `Manrope`, sans-serif.
- **Numbers, Durations & Timecodes:** `font-mono tabular-nums` (prevents width jitter during live playback position updates).

| Token | Size | Weight | Line Height | Tracking | Usage |
|---|---|---|---|---|---|
| `text-2xs` | `10px` | `500` | `14px` | `0.02em` | Badges, tags, codec indicators (FLAC, MP3) |
| `text-xs` | `12px` | `400` / `500` | `16px` | `0` | Timestamps, table column headers, status captions |
| `text-sm` | `13px` | `400` / `500` | `18px` | `0` | Standard body, track titles in lists, buttons |
| `text-base` | `15px` | `500` / `600` | `22px` | `-0.01em` | Section headings, dialog titles |
| `text-lg` | `18px` | `600` | `24px` | `-0.02em` | Album titles, room titles |
| `text-xl` | `22px` | `700` | `28px` | `-0.02em` | View header titles (Library, Home) |

---

## 4. Reusable Accessible UI Primitives

1. **Button Primitive (`components/ui/Button.tsx`)**
   - Variants: `primary` (Amber fill), `secondary` (Zinc border), `ghost` (Transparent with hover background), `danger` (Red subtle), `icon` (Square with accessible `aria-label` and tooltip).
   - Sizes: `xs` (24px), `sm` (32px), `md` (40px).
   - Loading treatment: Spinner inline replacing icon while keeping label dimensions constant to prevent layout shifts.

2. **Search Input (`components/ui/SearchInput.tsx`)**
   - Integrated magnifying glass icon, keyboard hint pill (`Ctrl+K`), and instant clear (`X`) button.
   - Debounced callback (150ms) to avoid over-querying SQLite FTS5 index.

3. **Virtual Track Table (`features/library/components/TrackTable.tsx`)**
   - High-performance windowing using `@tanstack/react-virtual` to handle 10,000+ tracks smoothly at 60fps.
   - Double-click plays track; right-click opens contextual menu.
   - Column layout: `#`, `Title & Artist`, `Album`, `Duration`, `Format/Bitrate`.

4. **Context Menu System (`components/ui/ContextMenu.tsx`)**
   - Keyboard accessible, native-feeling context menus:
     - *Play Now*
     - *Play Next*
     - *Add to Queue*
     - *Add to Playlist >*
     - *Show in File Explorer*
     - *Copy Metadata*

5. **Split Pane Dividers (`components/layout/ResizeHandle.tsx`)**
   - 4px wide interactive divider with invisible 12px hover hitbox. Supports drag-to-resize with persistent width saved in `settings.json`.

---

## 5. Keyboard Navigation & Global Shortcuts

| Shortcut | Scope | Action |
|---|---|---|
| `Space` | Global | Play / Pause toggle |
| `Ctrl + Right Arrow` | Global | Seek forward 5 seconds |
| `Ctrl + Left Arrow` | Global | Seek backward 5 seconds |
| `Shift + Right Arrow` | Global | Skip to next track in queue |
| `Shift + Left Arrow` | Global | Restart track / previous track |
| `Ctrl + Up Arrow` | Global | Increase volume by 5% |
| `Ctrl + Down Arrow` | Global | Decrease volume by 5% |
| `M` | Global | Mute / Unmute audio |
| `Ctrl + K` | Global | Focus global search input |
| `Ctrl + 1` | Global | Navigate to Home |
| `Ctrl + 2` | Global | Navigate to Library |
| `Ctrl + 3` | Global | Navigate to Playlists |
| `Ctrl + 4` | Global | Navigate to Rooms |
| `Ctrl + Q` | Global | Toggle Queue Drawer |
| `Ctrl + R` | Library | Trigger incremental folder rescan |
| `Escape` | Global | Close active modal, drawer, or search focus |

