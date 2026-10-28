# LEXI Music — mandatory project rules

## Canonical project identity

- Active installed app: https://lexi-music.github.io/
- Active source repository: https://github.com/lexi-music/lexi-music.github.io
- Default branch: main.
- Published files: dist/, including dist/music-player/.
- Production deployment: GitHub Pages through .github/workflows/pages.yml.
- The two-line LEXI / MUSIC header is the current established design.
- Startup landing playlist: GYM.

The following are retired or separate apps, NOT the active installed app:
- https://music-routing-test-alex.stilltrail18.chatgpt.site
- https://leiaorgana85-create.github.io/music-player/
- The Sites checkout /workspace/sites/music-routing-test.
- Preview-only copies, including lexi-music-ui-preview.

Never edit or publish a retired/test app to fulfill a request about the active LEXI Music app. An explicit user request identifying that other app is required. Older conversation summaries that identify the test site as current are superseded by this document.

## Required identity gate before edits

1. Read this file and fetch the current main branch HEAD and relevant source files from the canonical repository.
2. Verify the exact repository, branch, deployment workflow, and production origin. Do not select a project solely by its title, a local folder name, or a remembered earlier migration.
3. When the user supplies a screenshot, compare the actual header, controls, and behavior with the selected source. A mismatch requires re-diagnosis before editing or publishing.
4. Start from current main. Preserve newer changes; never port an older checkout over the active application.
5. Resolve uncertainty with connected source and prior migration history first. Do not ask the user to repeat information already available.

## Scope and preservation

- Preserve origin, manifest identity, downloaded audio, playlists, Favorites, settings, authorization, and established design.
- Keep presentation, hosting, and playback changes separate.
- For Gym-default requests, inspect all startup overrides, including full-test-loader.js. Changing a core default alone is insufficient when a later loader selects ALL.
- Use the smallest change supported by the verified cause. Do not introduce speculative resume behavior, new UI, or broad recovery changes.
- Do not clear storage, reset, delete downloads, or reinstall as routine troubleshooting.
- If a suggested step fails, stop and re-diagnose using the new evidence. Do not repeat or intensify it without an identified reason.

## Validation and publication

Before publishing, run:
- node tests/navigation-redirect.cjs
- node tests/drive-enable.cjs
- node tests/playback-transitions.cjs
- node tests/audio-handoff.cjs
- find dist -name '*.js' -print0 | xargs -0 -n1 node --check
- git diff --check

Keep the Pages deployment dependent on its check job. Do not bypass failed checks.
Update the relevant shell/script versions together and preserve compatibility aliases for older cached HTML.
Push a coherent commit to the canonical repository, respecting concurrent changes.
Verify that the GitHub Actions check and Pages deployment succeeded for that exact commit.
Verify the changed files served by https://lexi-music.github.io/ before declaring the correction published. A successful deployment to another origin is not completion.

## Evidence and reporting

- Distinguish source checks, automated tests, browser checks, production publication, and physical iPhone verification.
- Do not call a phone issue fixed merely because deployment succeeded, play() resolved, or the playback timer advanced. These do not prove audible lock-screen output.
- Do not diagnose the user's problem as a stale cache without evidence. Do not repeatedly ask them to reopen an app after that step has failed.
- If an earlier answer or edit was wrong, state the exact error, its cause, and the evidence supporting the correction.
- Keep user-facing updates concise. Never claim an action was performed unless it was.

## Enforced release identity and recurrence rules

- Read the Canonical Map and its Project instructions tab, the private Music runbook, this file, and current main before selecting an app. Conflicting older “current” paragraphs are historical; verify the production origin against live source.
- Run `node scripts/check-project.cjs` before editing and before committing. It rejects the wrong repository, Git remote, CI branch, Sites manifest, or PWA identity. The same check is mandatory in CI.
- The Music production target is only `https://lexi-music.github.io`. A deployment receipt from Sites or another GitHub origin cannot satisfy this task. Never ask the owner to migrate, reinstall, reset, clear storage, or download again to compensate for publishing to the wrong app.
- `project.json` records the canonical identity and playback build. Keep runtime query versions, worker aliases/cache and the diagnostics build label consistent. Script query versions and historical Sites version numbers are not installed-app version proof.
- The deploy job generates `release.json` from the checked commit. After Pages succeeds, `scripts/verify-production.cjs` must match that commit and every listed runtime file hash at the exact production origin. A successful push or Actions artifact upload alone is insufficient.
- Record the commit, Pages run, exact served build and remaining device-verification limits in the private project documents. Correct stale active-app summaries and actionable links; mark retained old release paragraphs as history.
- A reported recurrence requires checking the actual installed build and current source. Never assume stale cache or a particular iOS cause from an old log. An advancing timer and resolved play promise prove neither sound nor a permanent fix.
- Preserve latest-intent cancellation, bounded storage/native starts, missing-download handling and data isolation when changing audio architecture. Test fast prepared skips, rapid skips, Pause, resume, natural end/repeat, failed reads/starts and old-loader/current-worker compatibility.
