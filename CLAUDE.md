# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Manifest V3 Chrome/Edge extension (`QuickClip for Video`, prototype, v0.1.0) that lets a user cut a
≤60s clip out of a YouTube video that's currently playing and download it as WebM. No build step,
no dependencies, no package.json — plain files loaded directly as an unpacked extension:

- `manifest.json` — MV3 manifest. Content script matches all of `*://*.youtube.com/*` (match patterns are only evaluated on full page loads, so `/watch*` would miss SPA navigation; `content.js` gates mounting on `/watch`), no
  `permissions`, only `host_permissions` for youtube.com. No background/service worker, no popup.
  **It lists every `src/*.js` file in load order** — a new file must be added there.
- `src/*.js` — the extension, split by responsibility (see Architecture).
- `overlay.css` — styling for the injected UI.

## Development workflow

There's no build/lint/test tooling — edit `src/*.js`/`overlay.css` directly, then:

1. `chrome://extensions` (or `edge://extensions`) → enable "Mode développeur".
2. "Charger l'extension non empaquetée" → select this folder (first load), or hit the reload
   icon on the extension's card after edits.
3. Reload any already-open `youtube.com/watch?v=...` tab to reinject the updated content script
   (reloading the extension alone does not touch already-open tabs).
4. `scripts/package.ps1` zips manifest + `src/` + css + icons into `dist/` for the store.

For automated testing during development, this repo has `.mcp.json` configured with the
`chrome-devtools` MCP server (`chrome-devtools-mcp`, `--autoConnect`), which can drive a real
Chrome instance to load the unpacked extension, click/drag the UI, and read console output —
useful since there's no headless test suite. `--autoConnect` requires remote debugging enabled on
the target Chrome via `chrome://inspect/#remote-debugging`.

## Architecture

### Modules and load order

Content-script files can't use `import`/`export` (classic scripts), so they share one namespace,
`globalThis.VC`, in the isolated world (invisible to the YouTube page). Each file is an IIFE that
publishes a frozen object (`VC.selection`, `VC.panel`, ...). Load order (in `manifest.json`):

| File | Role |
|---|---|
| `constants.js` | `VC.config` (all tunables, no magic numbers) and `VC.messages` (UI strings) |
| `util.js` | `clamp`, `formatTime`, `safePlay` |
| `dom.js` | Lookups into YouTube's DOM (selectors live here only) |
| `state.js` | The only mutable state: `VC.state = { video, clip, isRecording }` |
| `selection.js` | **Pure** selection rules (`setBound`, `markAt`, `nudge`, `slideTo`); return new clips |
| `drag.js` / `track.js` | Pointer dragging / the track overlay (render, position, tooltip) |
| `panel.js` / `view.js` | Control panel; `view.refresh()` redraws track + panel from `state.clip` |
| `marks.js` / `preview.js` | Mark-at-playhead, nudge, reset / preview playback |
| `recorder.js` / `download.js` / `exporter.js` | Real-time recording (UI-agnostic) / file save / export flow |
| `shortcuts.js` / `fab.js` | I/O keys / the 🎬 trigger button |
| `content.js` | Entry point: mounts the UI and polls for navigation |

Only depend on modules loaded **earlier** at file top level (`const { x } = VC.y`); references to
later modules (e.g. `VC.track` from `drag.js`) must happen inside functions, at call time.

### Capture strategy (why it's built this way)

The extension does **not** extract YouTube's video stream. It captures the real playback of the
`<video>` element via `HTMLMediaElement.captureStream()` + `MediaRecorder` while the video plays
the selected range. This is more robust than stream extraction (which breaks on every YouTube
player change) but means clip generation happens in real time — a 30s clip takes ~30s to record.
Known limits: doesn't work on DRM/Widevine content, output is WebM only (no MP4 transcode).

### Injected UI is idempotent, because YouTube's own JS fights back

`mountUi()` (`content.js`) runs every 1s from a polling loop, since YouTube is an SPA with no
reliable single mount point. It calls three independently-guarded builders:

- `fab.ensure()` — the 🎬 button, inserted *inside* YouTube's `.ytp-right-controls` cluster (same
  integration point as SponsorBlock). YouTube periodically rewrites that innerHTML, evicting the
  button; `ensure()` re-attaches or re-creates it.
- `panel.build()` — the floating control panel, appended to `document.body`.
- `track.build()` — the clip-range track, a child of the player container (`#movie_player`),
  positioned above the native control bar (measured live in `track.position()`).

**Each bails out (only re-attaching if needed) when its root element already exists**, and event
listeners are wired *only* in the branch that creates the element (`drag.install()`, resize and
fullscreen listeners in `track.build()`). Wiring them on every call would stack duplicate handlers
on the same never-evicted elements. Global listeners (`shortcuts.install()`) are installed once
from `content.js`. When adding injected UI, follow the same pattern.

### Timeline maps the full video duration

The track maps 0 → `clip.duration` linearly, so its proportions are literally accurate (an earlier
zoomed-window design looked misleading and was dropped). On long videos the clip is a sliver, so
`track.js` widens only the *drawing* to `MIN_RANGE_PX` (`vc-narrow` class); drags read the real
pointer position and labels show true times.

### Long videos (>= 30 min): marking from the player

From `LONG_VIDEO_SECONDS` (`selection.isLongVideo()`) the panel shows "Start here" / "End here" buttons
and capture-phase I / O keys (overriding YouTube's "i" miniplayer shortcut while the panel is
open), plus -5/-1/+1/+5s nudges.

### State

`VC.state.clip` (`{ start, end, duration }` in absolute video seconds) is the single source of
truth for the selection, `null` while the panel is closed (so `clip !== null` means "open"). It is
treated as immutable: always replace it with the result of a `selection.*` function, then call
`VC.view.refresh()`. **`MAX_CLIP_SECONDS` is enforced in one place, `selection.setBound()`**, which
handle drags, marks and nudges all go through (`slideTo` preserves the span, so it can't exceed it).

Async flows (`preview.js`, `exporter.js`) copy `state.video`/`state.clip` into locals first: the
user can navigate away mid-recording, which resets the module-level state.
