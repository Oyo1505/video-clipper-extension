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

  // Firefox (desktop and Android) only exposes the prefixed mozCaptureStream().
  const captureFnOf = (video) => video.captureStream ?? video.mozCaptureStream;

  const canCaptureStream = (video) => typeof captureFnOf(video) === "function";

  function captureStreamOf(video) {
    return captureFnOf(video).call(video);
  }

  VC.util = Object.freeze({ clamp, formatTime, safePlay, canCaptureStream, captureStreamOf });
})();
