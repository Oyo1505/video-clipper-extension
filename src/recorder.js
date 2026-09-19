// Records a range of a playing <video> in real time via captureStream() + MediaRecorder.
// UI-agnostic: progress is reported through a callback, the result is a Blob.
(() => {
  const {
    SEEK_TIMEOUT_MS,
    SEEK_TOLERANCE_SECONDS,
    PREFERRED_MIME_TYPE,
    FALLBACK_MIME_TYPE,
  } = VC.config;
  const { safePlay } = VC.util;

  const pickMimeType = () =>
    MediaRecorder.isTypeSupported(PREFERRED_MIME_TYPE) ? PREFERRED_MIME_TYPE : FALLBACK_MIME_TYPE;

  // Resolves on "seeked", or after a timeout so a lost event can't hang the export.
  function waitForSeek(video) {
    return new Promise((resolve) => {
      const finish = () => {
        video.removeEventListener("seeked", finish);
        clearTimeout(timer);
        resolve();
      };
      const timer = setTimeout(finish, SEEK_TIMEOUT_MS);
      video.addEventListener("seeked", finish);
    });
  }

  async function seekTo(video, time) {
    if (Math.abs(video.currentTime - time) <= SEEK_TOLERANCE_SECONDS) return;
    video.currentTime = time;
    await waitForSeek(video);
  }

  // Resolves once playback reaches `end`, or the video ends (a clip finishing at the very
  // end of the video may never report a currentTime past `end`).
  function waitUntilReaches(video, end, onTick) {
    return new Promise((resolve) => {
      const finish = () => {
        video.removeEventListener("timeupdate", onTimeUpdate);
        video.removeEventListener("ended", finish);
        resolve();
      };
      const onTimeUpdate = () => {
        onTick();
        if (video.currentTime >= end) finish();
      };
      video.addEventListener("timeupdate", onTimeUpdate);
      video.addEventListener("ended", finish);
    });
  }

  // Collects the recorder's chunks; the promise resolves with the final Blob on stop.
  function collectBlob(recorder) {
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data?.size > 0) chunks.push(event.data);
    };
    return new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunks, { type: FALLBACK_MIME_TYPE }));
    });
  }

  /**
   * Plays `video` from `start` to `end` while recording it.
   * @param {HTMLVideoElement} video
   * @param {{start: number, end: number}} range in seconds
   * @param {(elapsedSeconds: number) => void} onProgress called on every playback tick
   * @returns {Promise<Blob>} the recorded WebM
   */
  async function record(video, { start, end }, onProgress) {
    await seekTo(video, start);

    const recorder = new MediaRecorder(video.captureStream(), { mimeType: pickMimeType() });
    const blobReady = collectBlob(recorder);

    recorder.start();
    safePlay(video);
    const startedAt = performance.now();
    try {
      await waitUntilReaches(video, end, () => onProgress((performance.now() - startedAt) / 1000));
    } finally {
      video.pause();
      if (recorder.state !== "inactive") recorder.stop();
    }
    return blobReady;
  }

  VC.recorder = Object.freeze({ record });
})();
