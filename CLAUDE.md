# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Manifest V3 Chrome/Edge extension (`Video Clipper`, prototype, v0.1.0) that lets a user cut a
≤60s clip out of a YouTube video that's currently playing and download it as WebM. No build step,
no dependencies, no package.json — three flat files loaded directly as an unpacked extension:

- `manifest.json` — MV3 manifest. Content script matches only `*://*.youtube.com/watch*`, no
  `permissions`, only `host_permissions` for youtube.com. No background/service worker, no popup.
- `content.js` — the entire extension, a single IIFE injected into the YouTube watch page.
- `overlay.css` — styling for the injected UI.

## Development workflow

There's no build/lint/test tooling — edit `content.js`/`overlay.css` directly, then:

1. `chrome://extensions` (or `edge://extensions`) → enable "Mode développeur".
2. "Charger l'extension non empaquetée" → select this folder (first load), or hit the reload
   icon on the extension's card after edits.
3. Reload any already-open `youtube.com/watch?v=...` tab to reinject the updated content script
   (reloading the extension alone does not touch already-open tabs).

For automated testing during development, this repo has `.mcp.json` configured with the
`chrome-devtools` MCP server (`chrome-devtools-mcp`, `--autoConnect`), which can drive a real
Chrome instance to load the unpacked extension, click/drag the UI, and read console output —
useful since there's no headless test suite. `--autoConnect` requires remote debugging enabled on
the target Chrome via `chrome://inspect/#remote-debugging`.

## Architecture

### Capture strategy (why it's built this way)

The extension does **not** extract YouTube's video stream. It captures the real playback of the
`<video>` element via `HTMLMediaElement.captureStream()` + `MediaRecorder` while the video plays
the selected range. This is more robust than stream extraction (which breaks on every YouTube
player change) but means clip generation happens in real time — a 30s clip takes ~30s to record.
Known limits: doesn't work on DRM/Widevine content, output is WebM only (no MP4 transcode).

### Injected UI is idempotent, because YouTube's own JS fights back

`buildUI()` (called every 1s by `watchForVideoChanges()`'s polling loop, since YouTube is an SPA
with no reliable single mount point) delegates to three independently-guarded builders:

- `ensureFab()` — the 🎬 trigger button. It's inserted *inside* YouTube's own
  `.ytp-right-controls` cluster (same integration point extensions like SponsorBlock use), not a
  floating page element. YouTube periodically rewrites `.ytp-right-controls`' innerHTML, which can
  evict this button from the DOM — `ensureFab()` detects that (`getElementById` returns null) and
  re-creates it.
- `ensurePanel()` — the floating control panel (labels/duration/buttons), appended to
  `document.body`, fixed-positioned bottom-right.
- `buildTrackOverlay()` — the draggable clip-range track, appended as a child of the player
  container (`#movie_player`), positioned above the native control bar height (measured live in
  `positionTrackOverlay()`, since that height varies with player size/theater/fullscreen).

**Each of these bails out early if its root element already exists**, and `setupDrag()` /
`setupRangeDrag()` are wired *only* inside `buildTrackOverlay()`'s creation branch — deliberately
not in `buildUI()` itself. If the fab gets evicted and rebuilt but the track/handles are wired
again elsewhere, event listeners double up on the same (never-evicted) handle elements, causing
duplicated/erratic drag behavior. When adding new injected UI, follow the same pattern: guard by
existence, wire interaction handlers only in the branch that creates the element.

### Timeline is a zoomed window, not the full video duration

The draggable track never maps to the full video length — for a long video, a ≤60s clip would be
a few unusable pixels wide. Instead `computeView()` sizes a viewport around the current selection
(`VIEW_PADDING_FACTOR = 1.6`× the clip span, `MIN_VIEW_SPAN = 20`s floor), so the selected range
always reads as roughly the same proportion of the track regardless of absolute video length.

- On panel open and after every drag ends, `rezoomView()` recomputes and recenters this window.
- During an active drag, the window itself stays fixed for stability, but `panViewToward()`
  auto-pans it when the pointer nears/passes the track edge, so a selection can be extended past
  what's currently visible.
- `panelState.{viewStart,viewEnd}` (the window) is distinct from `panelState.{start,end}` (the
  actual clip selection, in absolute video seconds) — don't conflate them when reading/writing
  handle positions (`style.left` is always a % of the *view* window, not the video duration).

### State

`panelState` (start/end/duration/viewStart/viewEnd/recording) is the single source of truth,
created on panel open and `null` until then. `MAX_CLIP_SECONDS = 60` is enforced in both the
single-handle drag math (`setupDrag`) and the whole-selection drag math (`setupRangeDrag`) —
change both if that cap ever changes.
