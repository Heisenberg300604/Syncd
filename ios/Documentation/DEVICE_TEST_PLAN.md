# Physical-device test plan

Simulator success does not establish background playback reliability (PRD §22.3).

Run every item on a real iPhone with a Debug build pointed at a reachable server. Record the device model, iOS version and result in the table at the end.

## Setup

1. In `Config/Local.xcconfig`, set `DEVELOPMENT_TEAM`, `SYNCD_CLERK_PUBLISHABLE_KEY`, and `SYNCD_API_BASE_URL = http:/$()/<mac-lan-ip>:5000/api`.
2. Start the server: `cd server && npm run dev`.
3. Have a second participant ready: the web client or a second device.

## A. Native audio (Profile → Playback lab, local file)

| # | Step | Expected |
| --- | --- | --- |
| A1 | Pick an MP3/M4A and play it | Audio plays. Mini-player shows title and progress. |
| A2 | Lock the device | Audio continues. Lock screen shows title, elapsed time and duration. |
| A3 | Pause/play from the lock screen | Audio responds. The in-app state matches on return. |
| A4 | Scrub on the lock screen | Position changes. In-app progress matches. |
| A5 | Control Center play/pause | Same as A3. |
| A6 | Background the app for 10+ minutes | Audio continues uninterrupted. |
| A7 | Receive a phone call, decline it | Audio resumes (`shouldResume`). |
| A8 | Receive a call, pause in-app during the call, then end the call | Audio stays paused (the intentional pause wins). |
| A9 | Invoke Siri mid-track | Audio ducks or pauses, then resumes. |
| A10 | Start audio in another app | SyncD pauses; the state shows paused. |
| A11 | Unplug wired headphones / disconnect Bluetooth | Audio pauses and does not continue on the speaker. |
| A12 | AirPods double-tap / squeeze | Play/pause toggles. |
| A13 | Force-quit and relaunch | No ghost Now Playing entry. Session is restored. |

## B. Rooms (YouTube tracks: no local audio until the source contract exists)

| # | Step | Expected |
| --- | --- | --- |
| B1 | Sign in, create a room | Room code shown. Connection shows "Live". |
| B2 | Web user joins by code | iOS presence updates within ~1 s. |
| B3 | iOS host plays a track from search | Web plays it. iOS shows the track with "Following room · no audio". |
| B4 | iOS host pause/seek | Web follows. |
| B5 | Web becomes host; iOS stays participant | iOS controls become read-only. Play/pause disabled. |
| B6 | Airplane mode for 30 s, then off | "Reconnecting" shown, then "Live". Position re-aligns. Chat history merges with no duplicates. |
| B7 | Background the app for 2+ minutes, return | Reconnects immediately (fresh token). State is current. |
| B8 | Host (iOS) goes offline for more than 30 s | Web sees the pending-host countdown, then a handover. |
| B9 | Leave room | Membership removed. Returns to the empty Room tab. |
| B10 | Send chat while offline | Send is disabled with an explanation. When a send fails, the error has a Retry. |

## C. Sync measurements (once a native source exists)

Record drift reported by `Log.sync` (Console.app, subsystem = bundle ID) on Wi-Fi, LTE and a degraded network (Network Link Conditioner). Use the results to tune `DriftPolicy`.

## Results

| Date | Device | iOS | Items | Pass/fail notes |
| --- | --- | --- | --- | --- |
| | | | | |
