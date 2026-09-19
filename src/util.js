(() => {
  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /** Formats seconds as m:ss, or h:mm:ss from one hour up. */
  function formatTime(rawSeconds) {
    const seconds = Math.max(0, Math.floor(rawSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = String(seconds % 60).padStart(2, "0");
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, "0")}:${secs}` : `${minutes}:${secs}`;
  }

  // play() rejects when interrupted by a pause/seek or blocked by autoplay policy;
  // there is nothing useful to do about it.
  function safePlay(video) {
    video.play()?.catch(() => {});
  }

  VC.util = Object.freeze({ clamp, formatTime, safePlay });
})();
