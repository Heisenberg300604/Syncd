# SyncD iOS

**A native iOS social music-listening experience.**

SyncD is a real-time social listening platform that lets people discover
music, create listening rooms, invite friends, manage shared queues, and
listen together with synchronized playback.

This repository contains the native iOS implementation of SyncD, built
using Swift and SwiftUI.

## Table of Contents

-   [Overview](#overview)
-   [Features](#features)
-   [Technology Stack](#technology-stack)
-   [Architecture](#architecture)
-   [Playback Architecture](#playback-architecture)
-   [Project Structure](#project-structure)
-   [Requirements](#requirements)
-   [Getting Started](#getting-started)
-   [Environment Configuration](#environment-configuration)
-   [Background Playback](#background-playback)
-   [Real-Time Synchronization](#real-time-synchronization)
-   [Backend Integration](#backend-integration)
-   [Development Guidelines](#development-guidelines)
-   [Testing](#testing)
-   [Roadmap](#roadmap)
-   [Known Limitations](#known-limitations)

## Overview

SyncD iOS is designed as an independent native iOS application rather
than a cross-platform UI port.

The application uses Apple's native audio and application frameworks to
provide: - Background audio playback. - Lock-screen playback controls. -
Control Center integration. - Native in-app mini-player. - Real-time
synchronized listening rooms. - Shared queues and room interaction. -
Authenticated remote audio streaming.

The iOS application shares the backend, API contracts, authentication
rules, and playback synchronization protocol with SyncD Web and SyncD
Android. It does not share their UI implementation.

## Features

### Authentication

-   User authentication through the existing SyncD authentication
    system.
-   Secure credential storage.
-   Session restoration.
-   Authentication error handling.

### Listening Rooms

-   Discover available rooms.
-   Create and join rooms.
-   View participants.
-   Display room playback state.
-   Respect room permissions and host controls.

### Music Player

-   Native AVPlayer-based playback.
-   Local and authorized remote audio sources.
-   Play, pause, seek, and track transitions.
-   Playback metadata.
-   Buffering and error handling.

### Background Playback

-   Audio playback while the application is backgrounded, for eligible
    sources.
-   Lock-screen metadata and controls.
-   Control Center integration.
-   Headphone and supported external media controls.
-   Audio interruption and route-change handling.

### Mini-player

-   Persistent player across application navigation.
-   Artwork, title, and artist.
-   Playback controls.
-   Navigation to the full player.
-   Loading, buffering, and error states.

### Shared Queue

-   View the current room queue.
-   Add and remove tracks according to permissions.
-   Reflect queue updates in real time.
-   Handle track transitions.

### Real-time Synchronization

-   Server-authoritative playback state.
-   Playback position reconciliation.
-   Drift correction.
-   Reconnection recovery.
-   Host and participant permissions.

### Social Features

-   Room chat.
-   Participant presence.
-   User profiles.
-   Room discovery.

## Technology Stack

  Category                Technology
  ----------------------- -------------------------
  Language                Swift
  UI                      SwiftUI
  Minimum iOS             iOS 17
  Audio engine            AVFoundation / AVPlayer
  Audio session           AVAudioSession
  Lock-screen metadata    MPNowPlayingInfoCenter
  Remote controls         MPRemoteCommandCenter
  Networking              URLSession
  Real-time               Socket.IO Client Swift
  Persistence             SwiftData
  Secure storage          Keychain
  Concurrency             Swift Concurrency
  Dependency management   Swift Package Manager
  Testing                 XCTest / Swift Testing

## Architecture

SyncD iOS follows a feature-based MVVM architecture with dedicated
playback and networking services.

### Architectural principles

1.  UI must not own audio playback.
2.  Audio playback must not depend on a SwiftUI view's lifecycle.
3.  Room synchronization must be independent of AVPlayer implementation.
4.  The backend remains authoritative for shared-room state.
5.  Network disconnections must not automatically destroy an active
    audio session.
6.  Business logic must be testable independently of the UI.
7.  Shared behaviour must follow the existing SyncD protocol.

### Main architectural layers

**Presentation** - SwiftUI screens. - ViewModels. - Navigation. - Design
system. - UI state.

**Application and domain** - Room use cases. - Queue management. -
Playback coordination. - Permission handling. - Authentication state.

**Infrastructure** - API clients. - Socket.IO client. - SwiftData
repositories. - Keychain storage. - Logging and diagnostics.

**Playback** - AVPlayer engine. - Audio session manager. - Now Playing
manager. - Remote command manager. - Playback synchronization
coordinator.

## Playback Architecture

Playback is divided into separate responsibilities.

  Component                Responsibility
  ------------------------ -------------------------------------------
  AVPlayer                 Actual audio playback
  Audio Session Manager    Audio focus, interruptions, route changes
  Playback Coordinator     Shared-room synchronization
  Now Playing Manager      Lock-screen and Control Center metadata
  Remote Command Manager   Hardware and system playback commands
  Socket Manager           Room events and real-time communication

### Background playback

Background playback is configured through: - The iOS Background Modes
capability. - Audio background mode. - AVAudioSession configured for
playback. - Appropriate player and session lifecycle management.

Background audio is available only for eligible sources and subject to
Apple's platform rules.

### YouTube content

YouTube playback must remain compliant with applicable YouTube API and
player policies. SyncD must not extract YouTube audio, separate its
audio from video, or provide prohibited background playback.

The application should represent source capabilities explicitly.

## Project Structure

The following is the intended structure. The actual implementation may
evolve as development progresses.

``` text
SyncD-iOS/
│
├── SyncD.xcodeproj/
│
├── SyncD/
│   ├── App/
│   │   ├── SyncDApp.swift
│   │   ├── AppCoordinator.swift
│   │   └── AppDependencies.swift
│   │
│   ├── Core/
│   │   ├── Authentication/
│   │   ├── Networking/
│   │   ├── Persistence/
│   │   ├── Models/
│   │   ├── DesignSystem/
│   │   ├── Errors/
│   │   └── Utilities/
│   │
│   ├── Features/
│   │   ├── Authentication/
│   │   ├── Home/
│   │   ├── Rooms/
│   │   ├── Player/
│   │   ├── Queue/
│   │   ├── Search/
│   │   ├── Chat/
│   │   ├── Profile/
│   │   └── Settings/
│   │
│   ├── Playback/
│   │   ├── Engine/
│   │   ├── Session/
│   │   ├── RemoteCommands/
│   │   ├── Coordinator/
│   │   ├── Synchronization/
│   │   ├── Streaming/
│   │   └── Models/
│   │
│   └── Resources/
│
├── SyncDTests/
├── SyncDUITests/
├── Config/
├── Documentation/
├── README.md
└── PRD.md
```

## Requirements

Before starting development, install: - macOS. - Xcode with an iOS SDK
compatible with the deployment target. - Swift toolchain compatible with
the selected Xcode version. - Git. - Access to the SyncD backend. -
Apple Developer account for device distribution and production signing.

A physical iPhone is strongly recommended for validating background
audio, Bluetooth routing, interruptions, and lock-screen behaviour.

## Getting Started

### 1. Clone the repository

``` bash
git clone <YOUR_SYNCd_IOS_REPOSITORY_URL>
cd SyncD-iOS
```

Replace the repository URL with the actual repository URL.

### 2. Open the project

``` bash
open SyncD.xcodeproj
```

If the project uses an `.xcworkspace`, open that instead.

### 3. Configure dependencies

Resolve Swift Package Manager dependencies through Xcode:

**File → Packages → Resolve Package Versions**

Ensure the selected Socket.IO Client Swift dependency is compatible with
the backend's Socket.IO server version.

### 4. Configure environment

Create a local development configuration using the documented example
configuration.

Do not commit: - API secrets. - Clerk secret keys. - Private signing
credentials. - Production authentication tokens. - Private stream
credentials.

### 5. Configure signing

Select the appropriate development team and bundle identifier in Xcode.

### 6. Run

Select an iPhone simulator or connected device and build the
application.

## Environment Configuration

The application should use environment-specific configuration.

Example configuration:

``` text
APP_ENV=development
API_BASE_URL=https://your-development-api.example
SOCKET_BASE_URL=https://your-development-socket.example
CLERK_PUBLISHABLE_KEY=your_publishable_key
```

These are illustrative variable names. The implementation must use the
actual authentication and configuration contracts in the existing SyncD
project.

Never place secret backend credentials inside the iOS application.

## Background Playback

Background playback is a core SyncD capability.

The implementation must correctly configure: - Background Modes →
Audio. - AVAudioSession playback category. - Player lifecycle. - Now
Playing metadata. - Remote playback commands. - Audio interruption
handling. - Audio route changes.

The app must not depend on its main screen remaining active for playback
to continue.

Background playback does not mean unrestricted background execution. iOS
controls application lifecycle and available background execution.

## Real-Time Synchronization

SyncD uses the existing backend playback protocol. The server is
authoritative for shared playback state.

Conceptually, expected position is calculated as:

`expectedPosition = initialPosition + elapsedServerTime × playbackRate`

The implementation must: - Validate incoming playback events. - Reject
stale events. - Respect room permissions. - Correct playback drift. -
Recover after network disconnection. - Reconcile state after
reconnecting. - Avoid conflicting local and remote commands.

Exact event names and payload structures must come from the existing
SyncD backend contract.

## Backend Integration

The iOS application integrates with the existing SyncD backend.

Expected backend responsibilities include: - Authentication. - User and
profile management. - Room creation and discovery. - Participant
presence. - Queue management. - Playback state authority. - Real-time
event distribution. - Authorized media stream access.

Do not duplicate these responsibilities in a separate iOS backend.

## Development Guidelines

-   Prefer small, focused Swift types.
-   Keep SwiftUI views lightweight.
-   Use MVVM consistently.
-   Use dependency injection.
-   Use async/await for asynchronous operations.
-   Isolate mutable shared state using actors where appropriate.
-   Use typed errors.
-   Avoid force unwraps in production code.
-   Avoid hardcoded API endpoints.
-   Avoid secrets in source control.
-   Avoid unnecessary abstractions.
-   Document backend contract assumptions.
-   Test on physical devices.

### UI state requirements

Every relevant screen and component must support: - Loading. -
Success/content. - Empty. - Error. - Offline. - Disabled or
restricted. - Buffering, where applicable.

## Testing

Run unit and UI tests using Xcode.

Critical test areas: - Authentication and session restoration. - Room
creation and joining. - Audio playback. - Background playback. -
Lock-screen controls. - Control Center controls. - Mini-player state. -
Queue updates. - Playback synchronization. - Network reconnection. -
Audio interruptions. - Bluetooth and headphone route changes. - Host-PC
stream availability.

Do not consider background playback verified solely because it works in
the simulator.

## Roadmap

### Phase 1 --- Foundation

-   Xcode project setup.
-   Architecture.
-   Design system.
-   Authentication.
-   API and Socket.IO clients.

### Phase 2 --- Native Playback

-   AVPlayer engine.
-   Audio session.
-   Background playback.
-   Now Playing metadata.
-   Remote commands.
-   In-app mini-player.

### Phase 3 --- Social Listening

-   Room discovery.
-   Create and join rooms.
-   Participant presence.
-   Shared queue.
-   Playback synchronization.

### Phase 4 --- Social Features

-   Chat.
-   Profiles.
-   Search.
-   Settings.

### Phase 5 --- Reliability

-   Reconnection.
-   Interruption recovery.
-   Error handling.
-   Performance testing.
-   Accessibility.
-   Physical-device testing.

## Known Limitations

-   Background playback depends on source eligibility and iOS
    audio-session rules.
-   YouTube content is subject to its own playback restrictions.
-   Host-PC streaming requires an authorized and reachable stream
    endpoint.
-   Real-time synchronization quality depends on network conditions and
    backend timestamp accuracy.
-   Some playback behaviour must be validated on physical devices.

## Project Status

Development status: **In development**

This README describes the intended architecture and product
capabilities. A feature should only be marked complete once
implementation and testing confirm it works.

## License

Add the project's actual license information before public distribution.
