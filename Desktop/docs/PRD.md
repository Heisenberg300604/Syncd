# SyncD Desktop — Product Requirements Document (PRD)

**Product:** SyncD Desktop  
**Version:** 1.0  
**Status:** Initial Product Specification  
**Platforms:** Windows first; macOS and Linux architecture compatibility  
**Product category:** Native desktop music player and social listening platform

---

# 1. Product overview

## 1.1 Vision

SyncD Desktop is a premium native music application that combines personal music library management, high-quality local playback and social listening.

Users should be able to manage their personal music collections, play music locally, organize playlists, join listening rooms, communicate with friends and synchronize playback with other SyncD users.

The desktop application will coexist with the existing SyncD Web application.

Both applications will use the same social backend and compatible room, queue and playback contracts.

## 1.2 Product philosophy

SyncD Desktop should be:

- Native rather than a browser wrapper.
- Local-first for personal music.
- Social when connected.
- Reliable during network interruptions.
- Fast with large music collections.
- Visually polished without unnecessary clutter.
- Accessible and keyboard-friendly.
- Modular and maintainable.

## 1.3 Non-goals

The following are explicitly outside the product scope:

- AI assistants.
- AI music recommendations.
- AI music discovery.
- AI-generated playlists.
- AI-generated themes.
- Cloud music storage.
- Replacing the existing Web application.
- Creating a duplicate backend.
- Using Electron as the desktop shell.
- Using HTMLAudioElement as the primary native audio engine.

---

# 2. Target users

### 2.1 Personal music listeners

Users who want to organize and play music stored on their computers.

Needs:
- Fast library scanning.
- Accurate metadata.
- Search.
- Playlists.
- Reliable playback.
- Persistent player controls.

### 2.2 Social listeners

Users who want to listen to music with friends.

Needs:
- Listening rooms.
- Shared queues.
- Synchronized playback.
- Chat.
- Participant presence.
- Host information.

### 2.3 Music library enthusiasts

Users with large collections stored across multiple drives and directories.

Needs:
- Multiple indexed folders.
- Incremental scanning.
- Duplicate handling.
- Artwork.
- Metadata editing or correction in a future phase.
- Large-library performance.

### 2.4 Room hosts

Users who create and manage listening sessions.

Needs:
- Queue management.
- Playback control permissions.
- Participant visibility.
- Host transfer.
- Reliable reconnect behavior.

---

# 3. Platforms and technology

## 3.1 Initial platform

Windows is the first supported release platform.

The architecture should not unnecessarily prevent macOS and Linux support.

## 3.2 Technology

| Layer | Technology |
|---|---|
| Desktop framework | Tauri 2 |
| Native language | Rust |
| Frontend | React |
| Language | TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS |
| Local database | SQLite |
| Search | SQLite FTS5 |
| Audio | Native Rust audio engine |
| Social backend | Existing Node.js backend |
| Realtime communication | Existing Socket.IO |
| Authentication | Existing Clerk integration, adapted securely for desktop |
| Remote database | Existing PostgreSQL through backend |

Technology choices must be verified against actual project requirements before implementation.

---

# 4. Repository architecture

The repository contains two independent applications.

```text
SyncD/
├── Desktop/
│   ├── src/
│   ├── src-tauri/
│   ├── docs/
│   └── ...
│
├── Web/
│   ├── client/
│   ├── server/
│   ├── docs/
│   └── ...
│
├── .github/
│   └── workflows/
│       ├── web-ci.yml
│       └── desktop-ci.yml
│
├── .gitignore
└── README.md
```

### Requirements

- Web and Desktop maintain separate dependencies.
- Web and Desktop have separate build processes.
- Both use the same root Git repository.
- Desktop must not depend on Web frontend code at runtime.
- Both connect to the same backend.
- Shared contracts should be introduced only when justified.
- Existing Web deployment must remain functional.
- Root GitHub Actions workflows must account for the new directory structure.
- Preserve Web-specific `.gitignore` rules and introduce appropriate root rules.

---

# 5. Design and user experience

## 5.1 Visual direction

Primary UI inspiration:

**T3 Code:** https://github.com/pingdotgg/t3code

Use it as a reference for desktop-first interaction design and interface organization.

### Desired characteristics

- Clear navigation hierarchy.
- Organized sidebars.
- Carefully structured content panels.
- Compact, readable layouts.
- Consistent component sizing.
- Restrained colors.
- Good typography.
- Thoughtful contextual menus.
- Keyboard shortcuts.
- Persistent application controls.
- Responsive desktop layout.
- Clear feedback for asynchronous operations.

### SyncD-specific adaptation

SyncD must feel like a premium music product.

Use album artwork, artist imagery and music-related information to create the visual identity.

Do not reproduce T3 Code's exact interface, branding or source code.

### Design principles

1. Content takes priority over decoration.
2. Important actions must be easy to discover.
3. Navigation should remain predictable.
4. The player should remain accessible.
5. The interface must not become visually noisy.
6. Animation should be subtle and purposeful.
7. All interactive controls need appropriate hover, focus, pressed and disabled treatments.
8. Layouts must remain usable when resized.

## 5.2 Design system

Establish reusable tokens for:

- Background.
- Surface.
- Elevated surface.
- Primary text.
- Secondary text.
- Muted text.
- Accent.
- Border.
- Focus.
- Success.
- Warning.
- Error.
- Spacing.
- Typography.
- Radius.
- Elevation.
- Motion.

Dark theme is the initial default.

Light theme should be supported if practical without creating a second inconsistent design system.

---

# 6. Application navigation

The initial primary navigation should contain:

1. Home.
2. Library.
3. Playlists.
4. Rooms.
5. Settings.

Additional sections such as Artists, Albums, Queue and Chat may be implemented as contextual destinations or sub-navigation.

The navigation must:

- Preserve relevant navigation state.
- Clearly indicate the active destination.
- Support keyboard navigation.
- Support window resizing.
- Provide appropriate tooltips where labels are collapsed.
- Avoid losing unsaved work when switching screens.

---

# 7. Functional requirements

## FR-01: Authentication

Users must be able to authenticate using the existing SyncD identity system.

Requirements:

- Inspect existing Clerk implementation.
- Support a secure desktop authentication flow.
- Handle login.
- Handle logout.
- Handle expired sessions.
- Handle token refresh.
- Handle authentication failure.
- Restore a valid session where supported.
- Securely store credentials using platform facilities.
- Never store authentication secrets in plain text settings.

Acceptance criteria:

- A user can authenticate successfully.
- An expired session is handled clearly.
- Protected backend actions require valid authorization.
- Logout clears locally stored credentials appropriately.
- Web and Desktop represent the same SyncD user identity.

## FR-02: Local music library

Users must be able to add one or more music directories.

Requirements:

- Folder picker.
- Multiple indexed folders.
- Recursive scanning.
- Incremental scanning.
- Background indexing.
- Cancellation.
- Rescanning.
- Metadata extraction.
- Artwork extraction.
- Duplicate detection.
- Missing-file detection.
- Unavailable-drive handling.
- Permission-error handling.
- Corrupt-file handling.
- Unsupported-format handling.
- Search and sorting.

External folders must be indexed without copying their contents.

Only explicit imports may copy files into managed Music storage.

Acceptance criteria:

- Users can add a folder.
- The scanner indexes supported files.
- The UI remains responsive.
- Indexed tracks persist across restarts.
- Missing folders are reported.
- Users can rescan.
- Failed files do not silently disappear.

## FR-03: Metadata

Extract relevant metadata:

- Track title.
- Artist.
- Album.
- Album artist.
- Track number.
- Disc number.
- Duration.
- Genre.
- Year.
- File format.
- File size.
- Bitrate where available.
- Artwork where available.
- File location.

Handle incomplete and inconsistent metadata.

Metadata extraction must not prevent playable tracks from appearing when some tags are missing.

## FR-04: Native playback

The application must support native local audio playback.

Requirements:

- Play.
- Pause.
- Resume.
- Stop.
- Previous.
- Next.
- Seek.
- Volume.
- Duration.
- Current position.
- Track completion.
- Queue.
- Playback error reporting.
- Device-change handling.
- Playback persistence across navigation.
- Background playback.

Playback must be implemented in Rust through a dedicated audio service.

React must not own the actual playback lifecycle.

The initial release should establish a documented supported-format matrix based on the chosen decoder.

## FR-05: Persistent player

The player must remain visible across the main application.

It should display:

- Artwork.
- Title.
- Artist.
- Previous.
- Play/pause.
- Next.
- Seek progress.
- Current time.
- Duration.
- Volume.
- Queue access.
- Playback status.
- Room synchronization status.

The displayed state must reflect the actual native audio engine.

## FR-06: Queue management

Users must be able to:

- Add tracks.
- Remove tracks.
- Reorder tracks.
- Clear the queue.
- Play a selected queue item.
- View the upcoming tracks.
- Handle an empty queue.

The queue must be consistent with actual playback.

Room queues must follow existing backend authority and permissions.

## FR-07: Playlists

Users must be able to:

- Create playlists.
- Rename playlists.
- Delete playlists.
- Add tracks.
- Remove tracks.
- Reorder tracks.
- Play a playlist.
- View playlist details.

Initially, playlists can be locally persisted.

The future synchronization strategy must be documented before introducing remote playlist synchronization.

Deleting a playlist must not delete the underlying music files.

## FR-08: Search

Search should support:

- Track title.
- Artist.
- Album.
- Genre.
- Relevant indexed metadata.

Requirements:

- SQLite FTS5.
- Responsive search.
- Empty results state.
- Clear search.
- Search error handling.
- Sorting and filtering where appropriate.

Search must not require a network connection for local library results.

## FR-09: Listening rooms

Users must be able to:

- View available rooms.
- Join rooms.
- Leave rooms.
- View participants.
- See the host.
- View the shared queue.
- View playback status.
- Chat.
- Reconnect after network interruptions.

The implementation must use the existing backend's actual capabilities and contracts.

## FR-10: Shared playback

Initial shared playback mode:

**Each participant plays their own local copy of the selected track.**

The backend owns the authoritative room playback intent and timeline.

Requirements:

- Resolve room tracks against the local library.
- Show when a track is missing locally.
- Do not silently substitute unrelated music.
- Synchronize play and pause.
- Synchronize seek and track changes.
- Periodically reconcile playback position.
- Apply bounded drift correction.
- Recover from network interruptions.
- Distinguish local player state from shared room state.

## FR-11: Host management

Requirements:

- Display current host.
- Enforce host permissions.
- Handle host disconnect.
- Support host transfer.
- Handle host reconnection.
- Handle simultaneous transfer attempts.
- Report transfer status.

Maintain compatibility with the existing backend's host-transfer behavior.

## FR-12: Chat

Requirements:

- Display room messages.
- Send messages.
- Display sender identity.
- Handle message ordering.
- Handle failed sends.
- Handle reconnect.
- Preserve an appropriate message history.

The chat interface must distinguish messages that are pending, sent or failed.

## FR-13: Settings

Settings should eventually include:

- Appearance.
- Music folders.
- Storage paths.
- Audio output device.
- Playback preferences.
- Volume preferences.
- Account.
- Diagnostics.
- Application version.

Settings must be persisted appropriately and validated.

## FR-14: Future host-streamed playback

This is not part of the initial MVP.

Future implementation should evaluate:

- WebRTC.
- STUN/TURN.
- Relay fallback.
- Incremental audio delivery.
- Separate voice and music channels.
- Authentication and authorization.
- Slow listener handling.
- Network recovery.
- Licensing implications.

Socket.IO must never be used to carry audio payloads.

---

# 8. Mandatory UI state requirements

This is a global product requirement.

**Every meaningful UI element and interactive component must have an intentional state design.**

No screen should be considered complete merely because its happy path works.

## 8.1 State categories

Applicable components must support:

| State | Expected behavior |
|---|---|
| Initial | Clear initial appearance |
| Loading | Progress or appropriate skeleton |
| Success | Accurate completed state |
| Empty | Helpful explanation and next action |
| Error | Specific error and recovery path |
| Disabled | Clear reason or unavailable treatment |
| Offline | Local or cached behavior where possible |
| Partial | Explain incomplete data |
| Permission denied | Explain missing permission |
| Retrying | Indicate recovery in progress |
| Confirmation | Explicitly confirm destructive actions |

Not every component needs every category, but every applicable category must be considered and documented.

## 8.2 Feature-specific examples

### Library

- No folders added.
- Initial scan.
- Scan in progress.
- Scan completed.
- No supported tracks found.
- Some files failed.
- Folder inaccessible.
- Drive disconnected.
- Permission denied.
- Database failure.
- Search returned nothing.
- Search failed.
- Artwork unavailable.
- Offline library loaded successfully.

### Player

- No track selected.
- Loading track.
- Playing.
- Paused.
- Seeking.
- Track unavailable.
- Unsupported format.
- Decoder error.
- Output device unavailable.
- Playback failed.
- Playback recovering.
- Empty queue.

### Rooms

- Loading rooms.
- No rooms available.
- Room list loaded.
- Joining room.
- Join successful.
- Join failed.
- Room full.
- Permission denied.
- Reconnecting.
- Disconnected.
- Room closed.
- Host disconnected.
- Host transfer pending.
- Host transfer completed.
- Host transfer failed.

### Chat

- Loading.
- Empty.
- Sending.
- Sent.
- Failed.
- Offline.
- Reconnecting.
- History unavailable.

### Settings

- Loading.
- Saving.
- Saved.
- Save failed.
- Invalid input.
- Permission denied.
- Reset confirmation.
- Reset completed.
- Reset failed.

## 8.3 State quality requirements

- Loading must eventually resolve to success, empty or error.
- Avoid indefinite spinners.
- Preserve user input on recoverable failures.
- Provide retry when safe.
- Never show false success.
- Never show empty content while initial loading is still active.
- Display understandable error messages.
- Distinguish offline data from current live data.
- Do not block unrelated interactions unnecessarily.
- Use confirmation for destructive operations.
- Ensure focus and screen-reader announcements work correctly.
- Do not use a generic full-screen error for a recoverable component-level failure.

## 8.4 Acceptance criteria

Each feature must have:

- A state matrix.
- Component-level state tests where appropriate.
- A defined error recovery path.
- Empty-state copy.
- Loading behavior.
- Success feedback where appropriate.

No feature is considered complete until its applicable states have been implemented and verified.

---

# 9. Data architecture

## 9.1 Local SQLite entities

Initial entities:

- Track.
- Artist.
- Album.
- IndexedFolder.
- Playlist.
- PlaylistTrack.
- PlaybackHistory.
- Settings.

The exact schema must be documented and versioned.

Requirements:

- Stable identifiers.
- Foreign keys.
- Appropriate indexes.
- Transactions.
- Migrations.
- Search indexes.
- Safe recovery from database errors.

Music files themselves must never be stored as database blobs by default.

## 9.2 Local storage layout

Desired Windows logical structure:

```text
User's Desktop/
└── SyncD/
    ├── App/
    ├── Index/
    │   └── library.db
    ├── Data/
    │   ├── artwork/
    │   ├── waveforms/
    │   ├── logs/
    │   ├── temp/
    │   └── settings.json
    └── Music/
```

The real Windows Desktop location must be resolved using OS known-folder APIs.

Handle redirected Desktop folders and OneDrive.

Keep persistent user data separate from replaceable binaries.

---

# 10. System architecture and ownership

| Responsibility | Owner |
|---|---|
| Local music files | User's filesystem |
| Local library metadata | Desktop SQLite |
| Local playback | Rust audio engine |
| Native filesystem access | Rust |
| Desktop presentation | React |
| Authentication identity | Existing SyncD backend / Clerk |
| Room membership | Existing backend |
| Chat | Existing backend |
| Queue authority | Existing backend |
| Host permissions | Existing backend |
| Shared playback timeline | Existing backend |
| Local track resolution | Desktop |
| Shared media transport, future | Dedicated media transport |

Keep boundaries explicit.

Do not allow the renderer to bypass backend authorization.

Do not allow a local player to silently overwrite room playback state.

---

# 11. Performance and reliability requirements

Performance goals must be measured on representative hardware.

Initial targets:

- Fast application startup.
- Responsive screen navigation.
- Responsive search on large libraries.
- Bounded memory consumption.
- No blocking library scans.
- Stable playback during navigation.
- Controlled artwork caching.
- No unnecessary continuous polling.
- Recoverable network interruptions.
- Correct database recovery behavior.

Benchmark library operations at:

- 10,000 tracks.
- 50,000 tracks.
- 100,000 tracks.

Measure indexing throughput, search latency, memory and CPU.

Do not claim target performance without actual measurements.

---

# 12. Accessibility requirements

- Keyboard navigation.
- Visible focus indicators.
- Accessible names for icon-only buttons.
- Screen-reader-friendly feedback.
- Logical focus order.
- Sufficient contrast.
- Reduced-motion support.
- Accessible dialogs.
- Keyboard-accessible menus.
- Appropriate tooltip behavior.
- No color-only status indicators.

---

# 13. Security requirements

- Restrictive Tauri permissions.
- Validated filesystem operations.
- Secure credential storage.
- No unrestricted shell access.
- No hardcoded secrets.
- No sensitive tokens in logs.
- Backend authorization for protected operations.
- Safe handling of untrusted metadata.
- No arbitrary renderer filesystem access.
- No silent destructive filesystem operations.

---

# 14. Testing strategy

### Unit testing

- State transitions.
- UI components.
- Database operations.
- Metadata extraction.
- Scanner behavior.
- Playback service.
- Error handling.

### Integration testing

- Real API contracts.
- Actual Socket.IO events.
- Room membership.
- Queue consistency.
- Host transfer.
- Reconnection.
- Playback synchronization.
- Local library and database integration.

### Cross-client testing

1. Desktop host + Web listener.
2. Web host + Desktop listener.
3. Desktop + Desktop.
4. Host disconnect and transfer.
5. Network loss and recovery.
6. Missing local track.
7. Playback drift.
8. Different local file availability.

### Release testing

- Windows installer.
- Clean installation.
- Upgrade.
- User data preservation.
- Uninstall behavior.
- Audio-device changes.
- Application crash recovery.
- Large library performance.

---

# 15. Delivery roadmap

| Phase | Deliverable |
|---|---|
| 0 | Repository audit and architecture documentation |
| 1 | Tauri, React, Rust and SQLite foundation |
| 2 | Design system, navigation and UI shell |
| 3 | Local library and scanner |
| 4 | Native audio engine and player |
| 5 | Backend authentication and social integration |
| 6 | Shared playback and synchronization |
| 7 | Release hardening and Windows distribution |
| Future | Host-streamed playback |

Each phase requires verification and review before proceeding.

---

# 16. MVP acceptance criteria

The initial usable SyncD Desktop release must satisfy the following:

### Application

- [ ] Installs and launches on Windows.
- [ ] Uses Tauri 2.
- [ ] Has independent Desktop dependencies.
- [ ] Does not break Web.
- [ ] Has a polished desktop interface.

### Library

- [ ] User can add music folders.
- [ ] Scanner indexes supported music.
- [ ] Metadata is persisted in SQLite.
- [ ] Search works offline.
- [ ] Missing files are handled.
- [ ] Library survives application restart.

### Playback

- [ ] Native Rust playback works.
- [ ] Play/pause works.
- [ ] Seek works.
- [ ] Volume works.
- [ ] Queue works.
- [ ] Playback continues while navigating.
- [ ] Playback errors are handled.

### Social

- [ ] User can authenticate.
- [ ] User can join a room.
- [ ] User can see participants.
- [ ] User can use chat.
- [ ] Shared queue is consistent.
- [ ] Playback synchronization works.
- [ ] Host transfer works with the existing backend.
- [ ] Reconnection restores appropriate state.

### UI quality

- [ ] Every screen has appropriate loading states.
- [ ] Every screen has appropriate empty states.
- [ ] Every screen has appropriate error states.
- [ ] Successful actions have accurate feedback.
- [ ] Disabled states are clear.
- [ ] Offline states are handled.
- [ ] Keyboard accessibility is supported.
- [ ] Reduced motion is respected.

### Engineering

- [ ] CI validates Desktop.
- [ ] Existing Web CI remains operational.
- [ ] Rust and frontend tests exist.
- [ ] Cross-client integration tests exist.
- [ ] User data survives upgrades.
- [ ] No AI features exist.
- [ ] No audio is sent through Socket.IO.

---

# 17. Success metrics

Evaluate the product using measurable outcomes.

### Library

- Scan throughput.
- Metadata extraction success rate.
- Search latency.
- Duplicate detection quality.
- Recovery from unavailable folders.

### Playback

- Playback startup latency.
- Playback failure rate.
- Audio interruptions.
- Memory consumption.
- Recovery after device changes.

### Social

- Room join success.
- Queue consistency.
- Reconnection success.
- Playback drift.
- Host transfer success.

### UX

- Navigation responsiveness.
- Accessibility coverage.
- State completeness.
- Error recovery success.
- User task completion.

---

# 18. Product decision principles

When making product or architecture decisions:

1. Prefer native reliability over shortcuts.
2. Prefer local-first functionality where appropriate.
3. Keep social authority on the existing backend.
4. Keep playback independent from React.
5. Keep the interface consistent.
6. Make all failure paths visible and recoverable.
7. Preserve user data.
8. Avoid unnecessary complexity.
9. Do not add AI.
10. Do not sacrifice long-term maintainability for a quick demo.

**Final product objective:** Build a native, reliable, premium desktop music application that makes personal music listening and social listening feel like one coherent experience.