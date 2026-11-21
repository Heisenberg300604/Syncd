# Task Plan: Bottom Player Auto-Hide & Sidebar Account Top-Left Relocation

## Overview
1. Update `Sidebar.tsx` to move the user profile / account info card to the top-left right under the brand header, with a guest/sign-in pill fallback when unauthenticated.
2. Update `usePlayerStore.ts` with a `hasPlaybackStarted` state flag so that on fresh boot (even with a persisted queue restored from SQLite), the player stays hidden until the user actively initiates local audio playback.
3. Update `BottomPlayer.tsx` to wrap the dock in Framer Motion's `AnimatePresence` and `motion.footer` for smooth slide-up/down transitions when active vs auto-hidden.
4. Update `App.tsx` and `globals.css` to dynamically adjust viewport bottom padding so that empty screen space is eliminated when the bottom dock is hidden.
5. Verify TypeScript types and build.

## Tasks
- [x] Task 1: Update `usePlayerStore.ts` with `hasPlaybackStarted` tracking
- [x] Task 2: Update `BottomPlayer.tsx` with `AnimatePresence` auto-hide animation and close/hide capability
- [x] Task 3: Update `App.tsx` and `globals.css` with dynamic padding support
- [x] Task 4: Update `Sidebar.tsx` with top-left Account Info and Guest fallback
- [x] Task 5: Validate files and clean code standards
