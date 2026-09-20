// The floating control panel (times, mark/nudge buttons, preview/export).
(() => {
  const { state, dom, selection, messages } = VC;
  const { formatTime } = VC.util;
  const { NUDGE_STEPS, MAX_CLIP_SECONDS } = VC.config;

  const PANEL_ID = "vc-panel";
  const STATUS_ID = "vc-status";

  const isOpen = () => dom.byId(PANEL_ID)?.classList.contains("vc-open") ?? false;

  function nudgeButtonHtml(which, delta) {
    const sign = delta > 0 ? "+" : "−";
    return `<button class="vc-mini vc-nudge" data-which="${which}" data-delta="${delta}">${sign}${Math.abs(delta)}s</button>`;
  }

  function markRowHtml(which) {
    const label = which === "start" ? "Start here" : "End here";
    return `
      <div class="vc-mark-row">
        <button class="vc-mini vc-mini-text vc-mark-here" data-which="${which}" title="Use the current playback position">${label}</button>
        ${NUDGE_STEPS.map((delta) => nudgeButtonHtml(which, delta)).join("")}
      </div>`;
  }

  function createPanel() {
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <h3>Create a clip <span id="vc-close">✕</span></h3>
      <div class="vc-times">
        <span id="vc-start-label">0:00</span>
        <span id="vc-end-label">0:00</span>
      </div>
      <div id="vc-duration" class="vc-duration">0s</div>
      <div id="vc-marks">
        <div class="vc-hint">Position playback with the YouTube bar, then mark the boundary (I / O keys).</div>
        ${markRowHtml("start")}
        ${markRowHtml("end")}
      </div>
      <div class="vc-buttons">
        <button id="vc-clear" class="vc-btn vc-btn-clear" title="Reset the selection">Reset</button>
        <button id="vc-preview" class="vc-btn">Preview</button>
        <button id="vc-validate" class="vc-btn">Confirm and download</button>
      </div>
      <div id="${STATUS_ID}"></div>
      <div class="vc-footer">
        <a href="${VC.bugReportUrl}" target="_blank" rel="noopener noreferrer">🐞 Report a bug</a>
        <a href="${VC.donationUrl}" target="_blank" rel="noopener noreferrer">☕ Support this project</a>
      </div>
    `;
    return panel;
  }

  // One delegated listener for every "Start/End here" and nudge button.
  function onMarksClick(event) {
    const button = event.target.closest("button[data-which]");
    if (!button) return;
    const { which, delta } = button.dataset;
    if (delta !== undefined) VC.marks.nudge(which, Number(delta));
    else VC.marks.markAtPlayhead(which);
  }

  /** Idempotent: does nothing once the panel exists. */
  function build() {
    if (dom.byId(PANEL_ID)) return;
    document.body.appendChild(createPanel());

    dom.byId("vc-close").addEventListener("click", close);
    dom.byId("vc-clear").addEventListener("click", VC.marks.reset);
    dom.byId("vc-preview").addEventListener("click", VC.preview.play);
    dom.byId("vc-validate").addEventListener("click", VC.exporter.run);
    dom.byId("vc-marks").addEventListener("click", onMarksClick);
  }

  function setStatus(text) {
    const el = dom.byId(STATUS_ID);
    if (el) el.textContent = text;
  }

  /** Disables the actions that would fight with an ongoing recording. */
  function setBusy(busy) {
    dom.byId("vc-validate").disabled = busy;
    dom.byId("vc-preview").disabled = busy;
  }

  /** Refreshes the times and length readout from state.clip. */
  function renderSummary() {
    const { clip } = state;
    if (!clip) return;
    dom.byId("vc-start-label").textContent = formatTime(clip.start);
    dom.byId("vc-end-label").textContent = formatTime(clip.end);

    const span = selection.spanOf(clip);
    const durationEl = dom.byId("vc-duration");
    durationEl.textContent = `${span.toFixed(1)}s selected (max ${MAX_CLIP_SECONDS}s)`;
    durationEl.classList.toggle("vc-warn", span >= MAX_CLIP_SECONDS - 0.05);
  }

  function open() {
    const video = dom.findVideo();
    if (!video || !Number.isFinite(video.duration) || video.duration <= 0) {
      setStatus(messages.videoNotReady);
      return;
    }
    state.video = video;
    state.clip = selection.createAt(video.currentTime, video.duration);

    const panel = dom.byId(PANEL_ID);
    panel.classList.toggle("vc-long", selection.isLongVideo(state.clip));
    panel.classList.add("vc-open");
    VC.track.setOpen(true);
    VC.track.position();
    dom.setNativeProgressBarHidden(true);
    VC.view.refresh();
    setStatus("");
  }

  function close() {
    dom.byId(PANEL_ID)?.classList.remove("vc-open");
    VC.track.setOpen(false);
    dom.setNativeProgressBarHidden(false);
    state.clip = null;
  }

  function toggle() {
    if (isOpen()) close();
    else open();
  }

  VC.panel = Object.freeze({ build, isOpen, open, close, toggle, setStatus, setBusy, renderSummary });
})();
