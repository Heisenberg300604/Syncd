# Task Plan: 10-Minute Heartbeat & Cold-Start Session Persistence

## Overview
1. Update `useAuthStore.ts` to implement dual-layer storage resilience (Native SQLite vault + LocalStorage user profile persistence) so user stays signed in across cold starts, restarts, and force quits.
2. Update the background token refresh / heartbeat worker to run every 10 minutes (600,000ms) with window focus awareness and silent refresh on 401 before any logout.
3. Update `Sidebar.tsx` to handle online/offline status gracefully with an amber status badge when offline while preserving full cached user profile display.
4. Verify all components and TypeScript interfaces.

## Tasks
- [ ] Task 1: Update `useAuthStore.ts` with user profile persistence, dual-layer vault sync, and 10-minute focus-aware heartbeat
- [ ] Task 2: Implement silent token refresh handling in `useAuthStore.ts`
- [ ] Task 3: Update `Sidebar.tsx` with offline/online status indicator
- [ ] Task 4: Verify TypeScript compilation and clean code standards
