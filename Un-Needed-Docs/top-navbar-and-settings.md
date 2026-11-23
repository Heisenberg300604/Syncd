# Implementation Plan: Top Navbar & Settings Toggle

**Task:** Design Top Navbar for Desktop App with Settings Toggle (Default: Sidebar, Persisted in SQLite)  
**Agent:** `frontend-specialist`  
**Layout Architecture:** Split into 2 Tiers — Frameless Title Bar (Window Drag, Search, Profile, Drawer, Controls) + Elevated Floating Capsule Pill (Navigation Tabs, Badge Counters, Shortcuts).

---

## 1. Scope & Architecture

1. **State & Persistence (`Desktop/src/stores/useSettingsStore.ts`):**
   - Key: `ui.navLayout`
   - Type: `'sidebar' | 'topbar'`
   - Default: `'sidebar'`
   - Persisted via Tauri commands: `set_setting` and `get_all_settings` (SQLite user database).

2. **Tier 1: Frameless TitleBar (`Desktop/src/components/layout/TitleBar.tsx`):**
   - Left: Brand Logo (`SyncDesk`) + `Desktop` badge
   - Center: `Ctrl + K` Search Bar (with drag region fillers)
   - Right: User Profile Avatar/Status + Drawer toggle (`PanelRight`) + Window controls (Min/Max/Close).
   - Generous drag regions for seamless desktop window movement.

3. **Tier 2: Floating Navigation Pill (`Desktop/src/components/layout/FloatingNavPill.tsx`):**
   - Suspended glassmorphic capsule centered horizontally near the top (`top-3.5`, `z-40`).
   - High-depth backdrop blur (`backdrop-blur-xl bg-zinc-950/85 border border-zinc-800/80 shadow-2xl rounded-full`).
   - Tabs: `Home`, `Library` (with count badge and unscanned audio indicator), `Playlists`, `Social Rooms`, `Settings`, and Shortcuts launcher (`?`).
   - Active state: amber glow accent pill with smooth transitions.

4. **Layout Shell (`Desktop/src/app/App.tsx`):**
   - When `navLayout === 'sidebar'`: Retains current Sidebar + left ResizeHandle.
   - When `navLayout === 'topbar'`: Sidebar & ResizeHandle hidden, viewport expands to full width, FloatingNavPill floats above views with `pt-14` initial breathing room.

5. **Settings UI (`Desktop/src/features/settings/SettingsView.tsx`):**
   - Visual layout preview cards in "Theme & Appearance":
     - Sidebar (Default)
     - Floating Pill & Title Bar (with accurate wireframe illustration of the floating island)
   - Amber active border and instant SQLite persistence.

---

## 2. Actionable Tasks

- [x] **Task 1:** Update `useSettingsStore.ts` with `navLayout` (`'sidebar' | 'topbar'`), SQLite loading, and `setNavLayout` setter.
- [x] **Task 2:** Refactor `TitleBar.tsx` into a clean Title Bar with ample window drag area, center search, account avatar, and right-drawer toggle.
- [x] **Task 3:** Create `FloatingNavPill.tsx` — a glassmorphic floating capsule with navigation tabs (`Home`, `Library` with count badge, `Playlists`, `Social Rooms`, `Settings`) and keyboard shortcuts launcher.
- [x] **Task 4:** Update `App.tsx` to conditionally toggle sidebar, render the centered floating pill above the viewport, and maintain full scrollbar ergonomics.
- [x] **Task 5:** Update `SettingsView.tsx` with updated wireframe preview mockup and description for "Floating Pill & Title Bar".
- [x] **Task 6:** Dynamic page alignment and centering across all views (`SettingsView`, `LibraryView`, `PlaylistsView`, `RoomsView`, `HomeView`) with `mx-auto` fluid containers and adaptive `pt-20` spacing below the floating pill.
- [x] **Task 7:** Position scrollbars at the far right edge of the desktop window (`w-full flex-1 overflow-y-auto` outer wrapper with inner `max-w-5xl mx-auto` content container) so scrollbars never float near the screen center.
