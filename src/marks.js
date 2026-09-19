// Editing the selection relative to the player: mark a boundary at the playhead, nudge
// it by a few seconds, or start over.
(() => {
  const { state, selection } = VC;

  function commit(clip) {
    state.clip = clip;
    VC.view.refresh();
    VC.panel.setStatus("");
  }

  function markAtPlayhead(which) {
    const { video, clip } = state;
    if (!video || !clip) return;
    commit(selection.markAt(clip, which, video.currentTime));
  }

  // Fine adjustment: shifts one boundary and seeks there, so the frame on screen is the
  // one being kept.
  function nudge(which, delta) {
    const { video, clip } = state;
    if (!video || !clip) return;
    video.pause();
    commit(selection.nudge(clip, which, delta));
    video.currentTime = state.clip[which];
  }

  // Discards a mistaken selection and re-seeds a default one at the playhead.
  function reset() {
    const { video, clip } = state;
    if (!video || !clip) return;
    commit(selection.createAt(video.currentTime, clip.duration));
  }

  VC.marks = Object.freeze({ markAtPlayhead, nudge, reset });
})();
