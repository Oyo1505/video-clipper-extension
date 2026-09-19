// Pure rules for the clip selection { start, end, duration }. Nothing here touches the
// DOM or the player, and every function returns a new clip instead of mutating its input.
(() => {
  const { MAX_CLIP_SECONDS, DEFAULT_CLIP_SECONDS, MIN_SELECTION_SECONDS, LONG_VIDEO_SECONDS } = VC.config;
  const { clamp } = VC.util;

  /** A fresh default-length selection starting at `time`. */
  function createAt(time, duration) {
    const start = clamp(time, 0, duration);
    return { start, end: Math.min(duration, start + DEFAULT_CLIP_SECONDS), duration };
  }

  /**
   * Moves one boundary, keeping the selection non-empty and within MAX_CLIP_SECONDS
   * (the other boundary stays put).
   */
  function setBound(clip, which, time) {
    if (which === "start") {
      const earliest = Math.max(0, clip.end - MAX_CLIP_SECONDS);
      const start = clamp(time, earliest, clip.end - MIN_SELECTION_SECONDS);
      return { ...clip, start: Math.max(0, start) };
    }
    const latest = Math.min(clip.duration, clip.start + MAX_CLIP_SECONDS);
    return { ...clip, end: clamp(time, clip.start + MIN_SELECTION_SECONDS, latest) };
  }

  /** Shifts one boundary by `delta` seconds. */
  function nudge(clip, which, delta) {
    return setBound(clip, which, clip[which] + delta);
  }

  /**
   * Sets a boundary to `time`. If that would leave an empty or too long selection, the
   * other boundary is re-seeded next to it instead (so "start here" far past the old end
   * just begins a fresh clip there).
   */
  function markAt(clip, which, time) {
    const t = clamp(time, 0, clip.duration);
    if (which === "start") {
      const needsNewEnd = t >= clip.end - MIN_SELECTION_SECONDS || clip.end - t > MAX_CLIP_SECONDS;
      const end = needsNewEnd ? Math.min(clip.duration, t + DEFAULT_CLIP_SECONDS) : clip.end;
      return { ...clip, start: Math.min(t, end - MIN_SELECTION_SECONDS), end };
    }
    const needsNewStart = t <= clip.start + MIN_SELECTION_SECONDS || t - clip.start > MAX_CLIP_SECONDS;
    const start = needsNewStart ? Math.max(0, t - DEFAULT_CLIP_SECONDS) : clip.start;
    return { ...clip, start, end: Math.max(t, start + MIN_SELECTION_SECONDS) };
  }

  /** Moves the whole selection so it starts at `start`, keeping its length. */
  function slideTo(clip, start) {
    const span = clip.end - clip.start;
    const newStart = clamp(start, 0, Math.max(0, clip.duration - span));
    return { ...clip, start: newStart, end: newStart + span };
  }

  const spanOf = (clip) => clip.end - clip.start;

  /** True when a <=60s clip is too small on the track to grab comfortably. */
  const isLongVideo = (clip) => clip !== null && clip.duration >= LONG_VIDEO_SECONDS;

  VC.selection = Object.freeze({ createAt, setBound, nudge, markAt, slideTo, spanOf, isLongVideo });
})();
