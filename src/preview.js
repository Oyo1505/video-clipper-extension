(() => {
  const { state } = VC;
  const { safePlay } = VC.util;

  /** Plays the selected range once, then pauses at its end. */
  function play() {
    // Captured locally: playback continues asynchronously, and if the user navigates to
    // another video meanwhile, state.video is reset - keep using the element we started.
    const { video, clip } = state;
    if (!video || !clip) return;
    const { start, end } = clip;

    video.currentTime = start;
    safePlay(video);

    const stopWatching = () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("pause", stopWatching);
    };
    const onTimeUpdate = () => {
      if (video.currentTime < end) return;
      video.pause();
      stopWatching();
    };
    video.addEventListener("timeupdate", onTimeUpdate);
    // A manual pause must not leave the listener behind: it would later cut off normal playback.
    video.addEventListener("pause", stopWatching);
  }

  VC.preview = Object.freeze({ play });
})();
