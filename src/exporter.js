// The "validate and download" flow: guards, UI feedback, recording, download, cleanup.
(() => {
  const { state, messages } = VC;
  const { safePlay } = VC.util;
  const { MIN_EXPORT_SECONDS } = VC.config;

  // Why the export can't start, or null when it can.
  function findBlocker(video, clipSeconds) {
    if (typeof video.captureStream !== "function") return messages.captureUnsupported;
    if (clipSeconds <= MIN_EXPORT_SECONDS) return messages.selectionTooShort;
    return null;
  }

  async function run() {
    // Captured locally: the recording is async and real-time, so it must not depend on
    // state.video / state.clip surviving a navigation or a panel close.
    const { video, clip } = state;
    if (!video || !clip || state.isRecording) return;

    const clipSeconds = clip.end - clip.start;
    const blocker = findBlocker(video, clipSeconds);
    if (blocker) {
      VC.panel.setStatus(blocker);
      return;
    }

    state.isRecording = true;
    VC.panel.setBusy(true);
    const wasPlaying = !video.paused;
    const originalTime = video.currentTime;

    try {
      const blob = await VC.recorder.record(video, clip, (elapsed) =>
        VC.panel.setStatus(messages.recording(Math.min(clipSeconds, elapsed), clipSeconds))
      );
      VC.panel.setStatus(messages.preparingDownload);
      VC.download.saveBlob(blob);
      VC.panel.setStatus(messages.downloaded);
    } catch (error) {
      console.error("Video Clipper error", error);
      VC.panel.setStatus(messages.recordingError);
    } finally {
      video.currentTime = originalTime;
      if (wasPlaying) safePlay(video);
      state.isRecording = false;
      VC.panel.setBusy(false);
    }
  }

  VC.exporter = Object.freeze({ run });
})();
