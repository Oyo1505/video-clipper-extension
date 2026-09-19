// Shared namespace. Every file in src/ is a classic content script running in the same
// isolated world (invisible to the YouTube page), so modules talk to each other through
// this single global, in the load order declared in manifest.json.
globalThis.VC = globalThis.VC ?? {};

VC.config = Object.freeze({
  MAX_CLIP_SECONDS: 60,
  DEFAULT_CLIP_SECONDS: 15,
  // Smallest gap kept between the two boundaries while editing.
  MIN_SELECTION_SECONDS: 0.1,
  // Below this, the selection is too short to be worth recording.
  MIN_EXPORT_SECONDS: 0.2,
  // From this length on, the panel offers "mark from the player" controls, since a <=60s
  // clip is a few pixels wide on the full-length track.
  LONG_VIDEO_SECONDS: 30 * 60,

  NARROW_RANGE_PX: 40,
  MIN_RANGE_PX: 16,
  NUDGE_STEPS: Object.freeze([-5, -1, 1, 5]),

  // Native control bar spacing, used to sit the track right above it.
  FALLBACK_BOTTOM_OFFSET_PX: 52,
  MIN_BOTTOM_OFFSET_PX: 8,
  CONTROLS_GAP_PX: 6,

  POLL_INTERVAL_MS: 1000,
  SEEK_TIMEOUT_MS: 3000,
  SEEK_TOLERANCE_SECONDS: 0.05,
  REVOKE_URL_DELAY_MS: 5000,
  FILENAME_TITLE_MAX_LENGTH: 60,

  PREFERRED_MIME_TYPE: "video/webm;codecs=vp9,opus",
  FALLBACK_MIME_TYPE: "video/webm",
});

VC.donationUrl = "https://paypal.me/HRIGOULET";

VC.messages = Object.freeze({
  videoNotReady: "Video not ready, try again in a moment.",
  captureUnsupported: "Capture is not supported on this video (protected content?).",
  selectionTooShort: "Select a longer portion.",
  recording: (elapsed, total) => `Recording... ${elapsed.toFixed(1)}s / ${total.toFixed(1)}s`,
  preparingDownload: "Preparing download...",
  downloaded: "Clip downloaded!",
  recordingError: "Error while recording.",
});
