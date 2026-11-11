# Locked-iPhone playback acceptance test — v1.10

**Status:** Real-device audible playback not yet verified. Passing automated tests and production deployment does not establish audible output on a locked iPhone.

This release extends the v1.09 passive diagnostics without changing audio transport, source selection, downloads, playlists, Favorites, settings, Google authorization or the app layout.

## Controlled acceptance test

1. Open installed LEXI Music, Settings, and confirm the *visible* version label reads **v1.10**. Do not reinstall, delete downloads, clear storage or reauthorize Drive.
2. Start a downloaded song with at least **two more downloaded songs** following it in the same playlist/queue. Verify sound is audible.
3. Open Settings and tap **Start locked-iPhone test**. Settings closes and saves the test start marker. Lock the phone.
4. Allow **two natural track transitions** while it remains locked. Do not tap Next during these transitions. Listen for actual audio from each subsequent song.
5. If both transitions succeed, use **Next once from the lock screen**, confirming the new song and artwork match what you hear.
6. Open Settings. Tap **I hear audio** if every step worked, or **Audio silent / stopped** immediately if playback failed or artwork and audio disagreed. Then tap **Share playback log** and attach the JSON file to the chat. If playback fails, do this before repeatedly pressing Play or Next, which can obscure the initial failure.

A new test starts at each tap of **Start locked-iPhone test**. Existing v1.09 audible/silent buttons are unchanged and are used to mark the outcome; the latest run's summary is included in exports.

## Evidence recorded

- Version, time, native audio and Media Session state, audio clock, duration, readiness, buffering, error codes, local media type, and whether the page was hidden.
- Playback generation, queue position, repeat/shuffle state, active/pending state, prefetch readiness, source handoffs, native progress confirmations and failure phases.
- Explicit manual audible/silent markers, elapsed time after return from the background, and observations of no media progress when timers actually execute.
- Up to 1,600 events and sparse 45-second normal progress samples, preserving previous evidence in the same storage key. Does **not** export song names, file IDs, OAuth tokens or song URLs.

## Limits and acceptance criteria

The browser cannot reliably execute instrumentation while iOS suspends the page; a delayed event or clock sample alone cannot verify actual audible audio. Only the device test can validate that.

Do **not** call the background playback bug fixed until the user confirms two audible automatic locked-screen song transitions and one audible Next with the correct artwork. If a test fails, use its log for a specific cause analysis and repeat the acceptance test after any repair.
