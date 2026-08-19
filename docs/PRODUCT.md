# SyncD — Product Specification

## 1. Product

SyncD is a lightweight social music-listening application where users can:

- create a room
- join a room using a room code
- search for music
- listen together
- synchronize playback
- see other users in the room
- chat in real time

Core value proposition:

> Create a room, share the code, and listen to music together in sync.

The product should prioritize a reliable shared listening experience with minimal setup.

---

# 2. Target Users

- Friends listening together remotely
- Small communities/groups
- Students
- People wanting a lightweight alternative to voice/video calls for shared music sessions

---

# 3. MVP

The MVP includes:

1. Landing page
2. Authentication
   - Google OAuth
   - Email magic link
3. User onboarding
   - Username after first authentication
4. Home page
   - Create Room
   - Join Room
5. Room creation
   - Unique room code
   - Creator becomes host
6. Join room
   - Room-code validation
7. Real-time room presence
8. YouTube music search
9. YouTube playback
   - play
   - pause
   - seek
   - current track
   - basic queue
10. Playback synchronization
11. Real-time chat
12. Leave room
13. Basic room lifecycle
14. Basic loading/error/empty states

---

# 4. User Flow

## New User

Landing
→ Authentication
→ First-time username onboarding
→ Home
→ Create Room
→ Room created
→ Share room code
→ Search music
→ Play music
→ Other users join
→ Synchronized playback
→ Chat

## Existing User

Landing
→ Login
→ Home
→ Join Room
→ Enter room code
→ Room validation
→ Enter room
→ Receive current playback state
→ Listen/chat

---

# 5. Room

A room has:

- unique ID
- unique human-friendly room code
- host
- persistent members
- current track
- playback state
- queue
- connected users
- chat messages

Example:

```text
Room: 7XK9PQ

Host: User A

Members:
- User A
- User B
- User C

Current track:
YouTube video

State:
Playing

Position:
01:42