(() => {
  const MAX_CLIP_SECONDS = 60;
  const DEFAULT_CLIP_SECONDS = 15;

  let video = null;
  let panelState = null; // { start, end, duration, recording }

  function fmtTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function findVideo() {
    return document.querySelector("video.html5-main-video") || document.querySelector("video");
  }

  function findPlayerContainer() {
    return document.getElementById("movie_player") || document.querySelector(".html5-video-player");
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // While at rest the track maps 1:1 onto the whole video, so its proportions are always
  // literally accurate. But on a long video a <=60s clip is then only a handful of
  // pixels wide, too small to grab or drag precisely. dragView is a temporary "magnifier":
  // set for the duration of an active handle/range drag only, discarded on release, so the
  // resting view never lies about proportion but dragging still has room to work with.
  let dragView = null;
  const DRAG_VIEW_SPAN_FACTOR = 3;
  const MIN_DRAG_VIEW_SPAN = 60;

  function computeDragView(centerTime, duration) {
    const span = Math.min(duration, Math.max(MIN_DRAG_VIEW_SPAN, MAX_CLIP_SECONDS * DRAG_VIEW_SPAN_FACTOR));
    const start = clamp(centerTime - span / 2, 0, Math.max(0, duration - span));
    return { start, end: Math.min(duration, start + span) };
  }

  function getRenderRange() {
    if (dragView) return dragView;
    return { start: 0, end: panelState ? panelState.duration : 1 };
  }

  // While dragging, shifts dragView when the pointer nears (or passes) its edge, so the
  // selection can be moved/extended beyond what's currently magnified into view.
  function panDragViewToward(rawRatio) {
    if (!dragView || !panelState) return;
    const span = dragView.end - dragView.start;
    const margin = 0.08;
    const r = clamp(rawRatio, -1, 2);
    let shift = 0;
    if (r < margin) {
      shift = (r - margin) * span * 0.5;
    } else if (r > 1 - margin) {
      shift = (r - (1 - margin)) * span * 0.5;
    }
    if (shift === 0) return;
    const newStart = clamp(dragView.start + shift, 0, Math.max(0, panelState.duration - span));
    dragView = { start: newStart, end: newStart + span };
  }

  // Each piece is built and wired at most once (guarded by its own element existing),
  // and re-attached (not re-created) on later calls. YouTube's own JS periodically
  // rebuilds .ytp-right-controls' innerHTML, which can evict our fab; without these
  // per-piece guards, that eviction made watchForVideoChanges rerun the whole builder
  // and double-attach listeners on the surviving (never-evicted) track handles.
  function buildUI() {
    ensureFab();
    ensurePanel();
    buildTrackOverlay();
  }

  function ensureFab() {
    if (document.getElementById("vc-fab")) {
      attachFab();
      return;
    }
    const fab = document.createElement("button");
    fab.id = "vc-fab";
    fab.className = "ytp-button";
    fab.title = "Creer un clip";
    fab.setAttribute("aria-label", "Creer un clip");
    fab.textContent = "🎬";
    fab.addEventListener("click", () => togglePanel());
    attachFab(fab);
  }

  function ensurePanel() {
    if (document.getElementById("vc-panel")) return;

    const panel = document.createElement("div");
    panel.id = "vc-panel";
    panel.innerHTML = `
      <h3>Creer un clip <span id="vc-close">✕</span></h3>
      <div class="vc-times">
        <span id="vc-start-label">0:00</span>
        <span id="vc-end-label">0:00</span>
      </div>
      <div id="vc-duration" class="vc-duration">0s</div>
      <div class="vc-buttons">
        <button id="vc-clear" class="vc-btn vc-btn-clear" title="Reinitialiser la selection">Reinitialiser</button>
        <button id="vc-preview" class="vc-btn">Apercu</button>
        <button id="vc-validate" class="vc-btn">Valider et telecharger</button>
      </div>
      <div id="vc-status"></div>
    `;
    document.body.appendChild(panel);

    document.getElementById("vc-close").addEventListener("click", () => togglePanel(false));
    document.getElementById("vc-clear").addEventListener("click", resetSelection);
    document.getElementById("vc-preview").addEventListener("click", onPreview);
    document.getElementById("vc-validate").addEventListener("click", onValidate);

    window.addEventListener("resize", positionTrackOverlay);
    document.addEventListener("fullscreenchange", positionTrackOverlay);
  }

  function buildTrackOverlay() {
    if (document.getElementById("vc-track-wrap")) return;
    const wrap = document.createElement("div");
    wrap.id = "vc-track-wrap";
    wrap.innerHTML = `
      <div id="vc-track"></div>
      <div id="vc-range"></div>
      <div id="vc-handle-start" class="vc-handle"></div>
      <div id="vc-handle-end" class="vc-handle"></div>
      <div id="vc-drag-tooltip"></div>
    `;
    attachTrackOverlay(wrap);

    // Attached here (not in buildUI) so a later buildUI() call - e.g. after YouTube
    // evicts the fab and watchForVideoChanges rebuilds it - never re-attaches these on
    // the same, still-alive elements.
    setupDrag("vc-handle-start", "start");
    setupDrag("vc-handle-end", "end");
    setupRangeDrag();
  }

  function attachTrackOverlay(wrap) {
    const el = wrap || document.getElementById("vc-track-wrap");
    if (!el) return;
    const parent = findPlayerContainer() || document.body;
    if (el.parentElement !== parent) {
      parent.appendChild(el);
    }
  }

  // Slots the trigger button into YouTube's own right-side control cluster (next to
  // settings/fullscreen), the way SponsorBlock and similar extensions do, instead of a
  // floating button detached from the player.
  function findRightControls() {
    const player = findPlayerContainer();
    return player ? player.querySelector(".ytp-right-controls") : null;
  }

  function attachFab(fab) {
    const el = fab || document.getElementById("vc-fab");
    if (!el) return;
    const controls = findRightControls();
    if (!controls) return;
    if (el.parentElement !== controls) {
      controls.insertBefore(el, controls.firstChild);
    }
  }

  // Positions the track right above the icon row, in the same slot YouTube's own progress
  // bar sits in (which we hide via setNativeProgressBarHidden() while the panel is open,
  // so there's one bar, not two stacked). .ytp-chrome-bottom's own box is used rather than
  // .ytp-progress-bar-container's, because YouTube collapses that container down to a
  // thin line flush with the player's bottom edge while controls are auto-hidden - reading
  // its rect at the wrong moment previously put our (taller) track right on top of the icon
  // row once controls became visible again. .ytp-chrome-bottom's box stays stable across
  // that hide/show transition.
  function positionTrackOverlay() {
    const wrap = document.getElementById("vc-track-wrap");
    const player = findPlayerContainer();
    if (!wrap || !player) return;
    const chromeBottom = player.querySelector(".ytp-chrome-bottom");
    const playerRect = player.getBoundingClientRect();
    let bottomOffset = 52;
    if (chromeBottom) {
      const chromeRect = chromeBottom.getBoundingClientRect();
      bottomOffset = Math.max(8, playerRect.bottom - chromeRect.top + 6);
    }
    wrap.style.bottom = `${bottomOffset}px`;
  }

  // Hides YouTube's own scrubber while we show our own, so there's a single bar in that
  // slot instead of two stacked on top of each other.
  function setNativeProgressBarHidden(hidden) {
    const player = findPlayerContainer();
    const progressBar = player ? player.querySelector(".ytp-progress-bar-container") : null;
    if (!progressBar) return;
    progressBar.style.display = hidden ? "none" : "";
  }

  function togglePanel(force) {
    const panel = document.getElementById("vc-panel");
    const trackWrap = document.getElementById("vc-track-wrap");
    if (!panel) return;
    const open = force !== undefined ? force : !panel.classList.contains("vc-open");
    if (open) {
      video = findVideo();
      if (!video || !isFinite(video.duration) || video.duration <= 0) {
        setStatus("Video non prete, reessaie dans un instant.");
        return;
      }
      const start = video.currentTime;
      const end = Math.min(video.duration, start + Math.min(DEFAULT_CLIP_SECONDS, MAX_CLIP_SECONDS));
      panelState = { start, end, duration: video.duration };
      panel.classList.add("vc-open");
      if (trackWrap) trackWrap.classList.add("vc-open");
      positionTrackOverlay();
      setNativeProgressBarHidden(true);
      renderTimeline();
      setStatus("");
    } else {
      panel.classList.remove("vc-open");
      if (trackWrap) trackWrap.classList.remove("vc-open");
      setNativeProgressBarHidden(false);
    }
  }

  function setStatus(text) {
    const el = document.getElementById("vc-status");
    if (el) el.textContent = text;
  }

  // Maps onto getRenderRange(): the whole video at rest (accurate proportions), or a
  // magnified dragView while a handle/the range is actively being dragged (see above).
  function renderTimeline() {
    if (!panelState) return;
    const { start, end } = panelState;
    const range = getRenderRange();
    const rangeSpan = range.end - range.start;
    const startPct = clamp(((start - range.start) / rangeSpan) * 100, 0, 100);
    const endPct = clamp(((end - range.start) / rangeSpan) * 100, 0, 100);

    document.getElementById("vc-handle-start").style.left = `${startPct}%`;
    document.getElementById("vc-handle-end").style.left = `${endPct}%`;
    document.getElementById("vc-range").style.left = `${startPct}%`;
    document.getElementById("vc-range").style.width = `${endPct - startPct}%`;

    document.getElementById("vc-start-label").textContent = fmtTime(start);
    document.getElementById("vc-end-label").textContent = fmtTime(end);

    const span = end - start;
    const durationEl = document.getElementById("vc-duration");
    durationEl.textContent = `${span.toFixed(1)}s selectionnees (max ${MAX_CLIP_SECONDS}s)`;
    durationEl.classList.toggle("vc-warn", span >= MAX_CLIP_SECONDS - 0.05);
  }

  function showDragTooltip(leftPct, time) {
    const tooltip = document.getElementById("vc-drag-tooltip");
    if (!tooltip) return;
    tooltip.textContent = fmtTime(time);
    tooltip.style.left = `${leftPct}%`;
    tooltip.classList.add("vc-visible");
  }

  function hideDragTooltip() {
    const tooltip = document.getElementById("vc-drag-tooltip");
    if (tooltip) tooltip.classList.remove("vc-visible");
  }

  function setupDrag(handleId, which) {
    const handle = document.getElementById(handleId);
    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      handle.setPointerCapture(e.pointerId);
      const track = document.getElementById("vc-track-wrap");
      handle.classList.add("vc-dragging");
      if (video && !video.paused) video.pause();
      dragView = computeDragView(which === "start" ? panelState.start : panelState.end, panelState.duration);
      renderTimeline();

      const onMove = (moveEvent) => {
        if (!panelState || !track.classList.contains("vc-open")) {
          onUp(moveEvent);
          return;
        }
        const rect = track.getBoundingClientRect();
        if (!(rect.width > 0)) return;
        const rawRatio = (moveEvent.clientX - rect.left) / rect.width;
        panDragViewToward(rawRatio);
        const range = getRenderRange();
        const ratio = clamp(rawRatio, 0, 1);
        let time = range.start + ratio * (range.end - range.start);

        if (which === "start") {
          time = Math.min(time, panelState.end - 0.1);
          time = Math.max(0, time);
          if (panelState.end - time > MAX_CLIP_SECONDS) {
            time = panelState.end - MAX_CLIP_SECONDS;
          }
          panelState.start = Math.max(0, time);
        } else {
          time = Math.max(time, panelState.start + 0.1);
          time = Math.min(panelState.duration, time);
          if (time - panelState.start > MAX_CLIP_SECONDS) {
            time = panelState.start + MAX_CLIP_SECONDS;
          }
          panelState.end = Math.min(panelState.duration, time);
        }
        renderTimeline();
        const shownTime = which === "start" ? panelState.start : panelState.end;
        const rangeNow = getRenderRange();
        const leftPct = clamp(((shownTime - rangeNow.start) / (rangeNow.end - rangeNow.start)) * 100, 0, 100);
        showDragTooltip(leftPct, shownTime);
        if (video) video.currentTime = shownTime;
      };

      const onUp = (upEvent) => {
        try {
          handle.releasePointerCapture(upEvent.pointerId);
        } catch {
          // pointer may already be released (e.g. capture lost mid-drag)
        }
        handle.classList.remove("vc-dragging");
        hideDragTooltip();
        dragView = null;
        renderTimeline();
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  }

  // Dragging inside the highlighted range (between the two handles) slides the whole
  // selection - both boundaries together, duration unchanged - along the video, the way
  // you'd drag a trim window along a timeline. Keeps whatever point was under the pointer
  // at pointerdown under the pointer as it moves.
  function setupRangeDrag() {
    const rangeEl = document.getElementById("vc-range");

    rangeEl.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      rangeEl.setPointerCapture(e.pointerId);
      const track = document.getElementById("vc-track-wrap");
      rangeEl.classList.add("vc-dragging");
      if (video && !video.paused) video.pause();

      const span = panelState.end - panelState.start;
      const rect0 = track.getBoundingClientRect();
      const ratio0 = rect0.width > 0 ? clamp((e.clientX - rect0.left) / rect0.width, 0, 1) : 0;
      const grabTime = ratio0 * panelState.duration;
      const offsetIntoSelection = clamp(grabTime - panelState.start, 0, span);
      dragView = computeDragView((panelState.start + panelState.end) / 2, panelState.duration);
      renderTimeline();

      const onMove = (moveEvent) => {
        if (!panelState || !track.classList.contains("vc-open")) {
          onUp(moveEvent);
          return;
        }
        const rect = track.getBoundingClientRect();
        if (!(rect.width > 0)) return;
        const rawRatio = (moveEvent.clientX - rect.left) / rect.width;
        panDragViewToward(rawRatio);
        const range = getRenderRange();
        const ratio = clamp(rawRatio, 0, 1);
        const pointerTime = range.start + ratio * (range.end - range.start);

        let newStart = pointerTime - offsetIntoSelection;
        newStart = clamp(newStart, 0, Math.max(0, panelState.duration - span));
        panelState.start = newStart;
        panelState.end = newStart + span;

        renderTimeline();
        const rangeNow = getRenderRange();
        const leftPct = clamp(((newStart - rangeNow.start) / (rangeNow.end - rangeNow.start)) * 100, 0, 100);
        showDragTooltip(leftPct, newStart);
        if (video) video.currentTime = newStart;
      };

      const onUp = (upEvent) => {
        try {
          rangeEl.releasePointerCapture(upEvent.pointerId);
        } catch {
          // pointer may already be released (e.g. capture lost mid-drag)
        }
        rangeEl.classList.remove("vc-dragging");
        hideDragTooltip();
        dragView = null;
        renderTimeline();
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  }

  // Re-seeds a fresh default clip at the current playhead, for discarding a mistaken
  // selection and starting over.
  function resetSelection() {
    if (!video || !panelState) return;
    const start = clamp(video.currentTime, 0, panelState.duration);
    const end = Math.min(panelState.duration, start + Math.min(DEFAULT_CLIP_SECONDS, MAX_CLIP_SECONDS));
    panelState.start = start;
    panelState.end = end;
    renderTimeline();
    setStatus("");
  }

  function onPreview() {
    if (!video || !panelState) return;
    // Captured locally: playback continues asynchronously (timeupdate), and if the user
    // navigates to a different video in the meantime, the module-level `video` is reset
    // to null - this closure must keep using the element it actually started playing.
    const v = video;
    const { start, end } = panelState;
    v.currentTime = start;
    v.play();

    const onTimeUpdate = () => {
      if (v.currentTime >= end) {
        v.pause();
        v.removeEventListener("timeupdate", onTimeUpdate);
      }
    };
    v.addEventListener("timeupdate", onTimeUpdate);
  }

  async function onValidate() {
    if (!video || !panelState || panelState.recording) return;
    if (typeof video.captureStream !== "function") {
      setStatus("Capture non supportee sur cette video (contenu protege ?).");
      return;
    }

    // Captured locally for the same reason as onPreview - this whole flow is async
    // (recording runs in real time) and must not depend on the module-level `video`
    // staying non-null for its duration.
    const v = video;
    const { start, end } = panelState;
    const clipDuration = end - start;
    if (clipDuration <= 0.2) {
      setStatus("Selectionne une portion plus longue.");
      return;
    }

    panelState.recording = true;
    const validateBtn = document.getElementById("vc-validate");
    const previewBtn = document.getElementById("vc-preview");
    validateBtn.disabled = true;
    previewBtn.disabled = true;

    const wasPlaying = !v.paused;
    const originalTime = v.currentTime;

    try {
      const stream = v.captureStream();
      const chunks = [];
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm";
      const recorder = new MediaRecorder(stream, { mimeType });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };

      const recordingDone = new Promise((resolve) => {
        recorder.onstop = resolve;
      });

      if (Math.abs(v.currentTime - start) > 0.05) {
        v.currentTime = start;
        await waitForSeek(v);
      }

      recorder.start();
      v.play();

      const startTs = performance.now();
      await new Promise((resolve) => {
        const onTimeUpdate = () => {
          const elapsed = (performance.now() - startTs) / 1000;
          setStatus(`Enregistrement... ${Math.min(clipDuration, elapsed).toFixed(1)}s / ${clipDuration.toFixed(1)}s`);
          if (v.currentTime >= end) {
            v.removeEventListener("timeupdate", onTimeUpdate);
            resolve();
          }
        };
        v.addEventListener("timeupdate", onTimeUpdate);
      });

      v.pause();
      recorder.stop();
      await recordingDone;

      setStatus("Preparation du telechargement...");
      const blob = new Blob(chunks, { type: "video/webm" });
      downloadBlob(blob);
      setStatus("Clip telecharge !");
    } catch (err) {
      console.error("Video Clipper error", err);
      setStatus("Erreur pendant l'enregistrement.");
    } finally {
      v.currentTime = originalTime;
      if (wasPlaying) v.play();
      panelState.recording = false;
      validateBtn.disabled = false;
      previewBtn.disabled = false;
    }
  }

  function waitForSeek(videoEl) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        videoEl.removeEventListener("seeked", onSeeked);
        clearTimeout(timer);
        resolve();
      };
      const onSeeked = () => finish();
      videoEl.addEventListener("seeked", onSeeked);
      const timer = setTimeout(finish, 3000);
    });
  }

  function downloadBlob(blob) {
    const url = URL.createObjectURL(blob);
    const title = (document.title || "clip").replace(/[\\/:*?"<>|]/g, "_").slice(0, 60);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title}_${ts}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function init() {
    buildUI();
  }

  function watchForVideoChanges() {
    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        togglePanel(false);
        video = null;
      }
      buildUI();
      attachTrackOverlay();
    }, 1000);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
  watchForVideoChanges();
})();
