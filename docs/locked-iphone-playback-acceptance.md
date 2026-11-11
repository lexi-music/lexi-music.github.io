# Locked-iPhone playback acceptance test — v1.09

**Status:** Real device verification required. Passing CI and GitHub Pages deployment does **not** prove that audio is audible when an iPhone is locked.

This release changes only passive diagnostics and their in-app test controls; it does not change the playback engine, library, downloaded audio, playlists, Favorites, OAuth, settings or app design.

## One controlled test

1. Open the installed LEXI Music app, Settings, and confirm its **visible** version label is **v1.09**. Do not reinstall, delete downloads, clear storage, or reauthorize Drive.
2. Start a downloaded song with **at least two more downloaded songs** queued behind it. Confirm it is audible.
3. Open Settings and tap **Start locked-iPhone test**. The Settings dialog closes and a start marker is saved. Lock the screen.
4. Allow **two complete songs to change automatically** while the phone stays locked. Do not tap Next until after these two natural transitions; note whether the next song is actually audible each time.
5. After both work, try **one Next action on the lock screen** and confirm the new song is audible. Open the app, Settings, then **Playback worked · share log**.
6. If audio becomes silent, stops, gets stuck at 0 seconds, or lock-screen artwork/title mismatches the audio at any point, **do not tap Play/Next repeatedly first**. Open the app, Settings, then **Playback stopped · share log** and describe the symptom in one sentence.

The share sheet creates `lexi-music-playback-log.json`, which can be attached to a ChatGPT message. Separate runs can be made for shuffle on/off or repeat-one, but each needs its own Start marker and exported log.

## What the log can and cannot prove

- Contains timestamped media and visibility events, generation, queue positions, repeat/shuffle state, prefetch readiness, actual audio playhead, readiness/network state, and the markers for when the user heard silence or success.
- Stores up to 1,600 events with progress sampled every 45 seconds, preserving the legacy diagnostics key. It does not record song titles, local file IDs, URLs, credentials, or actual audio.
- Records visibility-return observations and an outcome summary, but **cannot observe actual sound output** or execute JavaScript while iOS has suspended the page. The user's audible result is the deciding evidence.
- CI covers passive behavior, privacy, persistence, event timing, test markers, summary export, and playback trace wiring; actual locked-iPhone audio cannot be simulated by Node tests.

## Definition of acceptance

**Do not label the playback bug fixed** until the iPhone audibly completes the two natural locked-screen transitions and one manual lock-screen Next with no silence, skipped song, or wrong artwork. A failure log drives a targeted repair and a repeat of this same acceptance test. If OS background suspension prevents evidence entirely, note that limitation rather than inventing a cause.
