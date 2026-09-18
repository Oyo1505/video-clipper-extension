(() => {
  const MAX_CLIP_SECONDS = 60;

  let video = null;
  let panelState = null; // { start, end, dragging, recording }

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

  // Zooms the track onto a window around the selection instead of the whole video,
  // otherwise a 60s clip is a few unusable pixels wide on a long video.
  function computeInitialView(start, end, duration) {
    const span = Math.min(duration, Math.max(MAX_CLIP_SECONDS * 2, 120));
    let viewStart = clamp((start + end) / 2 - span / 2, 0, Math.max(0, duration - span));
    const viewEnd = Math.min(duration, viewStart + span);
    return { viewStart, viewEnd };
  }

  // While dragging, shifts the visible window when the pointer nears (or passes) its edge
  // so the selection can be extended beyond what's currently on screen.
  function panViewToward(rawRatio) {
    const viewSpan = panelState.viewEnd - panelState.viewStart;
    const margin = 0.08;
    const r = clamp(rawRatio, -1, 2);
    let shift = 0;
    if (r < margin) {
      shift = (r - margin) * viewSpan * 0.5;
    } else if (r > 1 - margin) {
      shift = (r - (1 - margin)) * viewSpan * 0.5;
    }
    if (shift === 0) return;
    const newViewStart = clamp(panelState.viewStart + shift, 0, Math.max(0, panelState.duration - viewSpan));
    panelState.viewStart = newViewStart;
    panelState.viewEnd = newViewStart + viewSpan;
  }

  function buildUI() {
    if (document.getElementById("vc-fab")) return;

    const fab = document.createElement("div");
    fab.id = "vc-fab";
    fab.title = "Creer un clip";
    fab.textContent = "🎬";
    document.body.appendChild(fab);

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
        <button id="vc-preview" class="vc-btn">Apercu</button>
        <button id="vc-validate" class="vc-btn">Valider et telecharger</button>
      </div>
      <div id="vc-status"></div>
    `;
    document.body.appendChild(panel);

    buildTrackOverlay();

    fab.addEventListener("click", () => togglePanel());
    document.getElementById("vc-close").addEventListener("click", () => togglePanel(false));
    document.getElementById("vc-preview").addEventListener("click", onPreview);
    document.getElementById("vc-validate").addEventListener("click", onValidate);

    setupDrag("vc-handle-start", "start");
    setupDrag("vc-handle-end", "end");
    setupRangeDrag();

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
  }

  function attachTrackOverlay(wrap) {
    const el = wrap || document.getElementById("vc-track-wrap");
    if (!el) return;
    const parent = findPlayerContainer() || document.body;
    if (el.parentElement !== parent) {
      parent.appendChild(el);
    }
  }

  function positionTrackOverlay() {
    const wrap = document.getElementById("vc-track-wrap");
    const player = findPlayerContainer();
    if (!wrap || !player) return;
    const chromeBottom = player.querySelector(".ytp-chrome-bottom");
    let bottomOffset = 52;
    if (chromeBottom) {
      const playerRect = player.getBoundingClientRect();
      const chromeRect = chromeBottom.getBoundingClientRect();
      bottomOffset = Math.max(8, playerRect.bottom - chromeRect.top + 6);
    }
    wrap.style.bottom = `${bottomOffset}px`;
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
      attachTrackOverlay();
      const start = video.currentTime;
      const end = Math.min(video.duration, start + Math.min(15, MAX_CLIP_SECONDS));
      const view = computeInitialView(start, end, video.duration);
      panelState = { start, end, duration: video.duration, viewStart: view.viewStart, viewEnd: view.viewEnd };
      panel.classList.add("vc-open");
      if (trackWrap) trackWrap.classList.add("vc-open");
      positionTrackOverlay();
      renderTimeline();
      setStatus("");
    } else {
      panel.classList.remove("vc-open");
      if (trackWrap) trackWrap.classList.remove("vc-open");
    }
  }

  function setStatus(text) {
    const el = document.getElementById("vc-status");
    if (el) el.textContent = text;
  }

  function renderTimeline() {
    if (!panelState) return;
    const { start, end, viewStart, viewEnd } = panelState;
    const viewSpan = viewEnd - viewStart;
    const startPct = clamp(((start - viewStart) / viewSpan) * 100, 0, 100);
    const endPct = clamp(((end - viewStart) / viewSpan) * 100, 0, 100);

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

      const onMove = (moveEvent) => {
        const rect = track.getBoundingClientRect();
        const rawRatio = (moveEvent.clientX - rect.left) / rect.width;
        panViewToward(rawRatio);
        const viewSpan = panelState.viewEnd - panelState.viewStart;
        const ratio = clamp(rawRatio, 0, 1);
        let time = panelState.viewStart + ratio * viewSpan;

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
        const leftPct = clamp(((shownTime - panelState.viewStart) / viewSpan) * 100, 0, 100);
        showDragTooltip(leftPct, shownTime);
        if (video) video.currentTime = shownTime;
      };

      const onUp = (upEvent) => {
        handle.releasePointerCapture(upEvent.pointerId);
        handle.classList.remove("vc-dragging");
        hideDragTooltip();
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  }

  function setupRangeDrag() {
    const rangeEl = document.getElementById("vc-range");
    rangeEl.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      rangeEl.setPointerCapture(e.pointerId);
      const track = document.getElementById("vc-track-wrap");
      const rect = track.getBoundingClientRect();
      const startX = e.clientX;
      const initial = { start: panelState.start, end: panelState.end };
      const span = initial.end - initial.start;
      rangeEl.classList.add("vc-dragging");
      if (video && !video.paused) video.pause();

      const viewSpan = panelState.viewEnd - panelState.viewStart;

      const onMove = (moveEvent) => {
        const deltaRatio = (moveEvent.clientX - startX) / rect.width;
        const deltaTime = deltaRatio * viewSpan;
        let newStart = initial.start + deltaTime;
        let newEnd = initial.end + deltaTime;
        if (newStart < 0) {
          newStart = 0;
          newEnd = span;
        }
        if (newEnd > panelState.duration) {
          newEnd = panelState.duration;
          newStart = panelState.duration - span;
        }
        panelState.start = newStart;
        panelState.end = newEnd;
        renderTimeline();
        const leftPct = clamp(((newStart - panelState.viewStart) / viewSpan) * 100, 0, 100);
        showDragTooltip(leftPct, newStart);
        if (video) video.currentTime = newStart;
      };

      const onUp = (upEvent) => {
        rangeEl.releasePointerCapture(upEvent.pointerId);
        rangeEl.classList.remove("vc-dragging");
        hideDragTooltip();
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    });
  }

  function onPreview() {
    if (!video || !panelState) return;
    const { start, end } = panelState;
    video.currentTime = start;
    video.play();

    const onTimeUpdate = () => {
      if (video.currentTime >= end) {
        video.pause();
        video.removeEventListener("timeupdate", onTimeUpdate);
      }
    };
    video.addEventListener("timeupdate", onTimeUpdate);
  }

  async function onValidate() {
    if (!video || !panelState || panelState.recording) return;
    if (typeof video.captureStream !== "function") {
      setStatus("Capture non supportee sur cette video (contenu protege ?).");
      return;
    }

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

    const wasPlaying = !video.paused;
    const originalTime = video.currentTime;

    try {
      const stream = video.captureStream();
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

      if (Math.abs(video.currentTime - start) > 0.05) {
        video.currentTime = start;
        await waitForSeek(video);
      }

      recorder.start();
      video.play();

      const startTs = performance.now();
      await new Promise((resolve) => {
        const onTimeUpdate = () => {
          const elapsed = (performance.now() - startTs) / 1000;
          setStatus(`Enregistrement... ${Math.min(clipDuration, elapsed).toFixed(1)}s / ${clipDuration.toFixed(1)}s`);
          if (video.currentTime >= end) {
            video.removeEventListener("timeupdate", onTimeUpdate);
            resolve();
          }
        };
        video.addEventListener("timeupdate", onTimeUpdate);
      });

      video.pause();
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
      video.currentTime = originalTime;
      if (wasPlaying) video.play();
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
      if (!document.getElementById("vc-fab")) {
        buildUI();
      } else {
        attachTrackOverlay();
      }
    }, 1000);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    init();
  } else {
    document.addEventListener("DOMContentLoaded", init);
  }
  watchForVideoChanges();
})();
