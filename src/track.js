// The draggable clip-range track injected into YouTube's player.
//
// The track maps directly onto the video's full duration (0 to clip.duration) - no
// zoomed/windowed view - so its proportions are always literally accurate, even though a
// short clip on a long video is then a thin sliver rather than a comfortably wide target
// (chosen deliberately: a zoomed view looked misleading once the track became a solid
// two-tone bar).
(() => {
  const { state, dom } = VC;
  const { clamp, formatTime } = VC.util;
  const {
    NARROW_RANGE_PX,
    MIN_RANGE_PX,
    FALLBACK_BOTTOM_OFFSET_PX,
    MIN_BOTTOM_OFFSET_PX,
    CONTROLS_GAP_PX,
  } = VC.config;

  const WRAP_ID = "vc-track-wrap";
  const START_HANDLE_ID = "vc-handle-start";
  const END_HANDLE_ID = "vc-handle-end";
  const RANGE_ID = "vc-range";
  const TOOLTIP_ID = "vc-drag-tooltip";

  const toPercent = (time, duration) => clamp((time / duration) * 100, 0, 100);

  // On long videos the selection is only a few px wide, and full-size handles would cover
  // it entirely (nothing left to grab to slide it). Then the handles go slim and the drawn
  // range (and the end handle with it) is widened to MIN_RANGE_PX, so the handles frame a
  // grabbable range. Only the drawing is widened; drags read the pointer position and the
  // labels show the true times.
  function layoutRange(clip, widthPx) {
    const startPct = toPercent(clip.start, clip.duration);
    const endPct = toPercent(clip.end, clip.duration);
    const isNarrow = ((endPct - startPct) / 100) * widthPx < NARROW_RANGE_PX;
    if (!isNarrow) return { startPct, endPct, isNarrow };

    const minWidthPct = widthPx > 0 ? (MIN_RANGE_PX / widthPx) * 100 : 0;
    return { startPct, endPct: Math.min(100, Math.max(endPct, startPct + minWidthPct)), isNarrow };
  }

  function render() {
    const { clip } = state;
    if (!clip) return;
    const wrap = dom.byId(WRAP_ID);
    const { startPct, endPct, isNarrow } = layoutRange(clip, wrap.clientWidth);

    wrap.classList.toggle("vc-narrow", isNarrow);
    dom.byId(START_HANDLE_ID).style.left = `${startPct}%`;
    dom.byId(END_HANDLE_ID).style.left = `${endPct}%`;
    const range = dom.byId(RANGE_ID);
    range.style.left = `${startPct}%`;
    range.style.width = `${endPct - startPct}%`;
  }

  function showTooltip(time) {
    const tooltip = dom.byId(TOOLTIP_ID);
    if (!tooltip) return;
    tooltip.textContent = formatTime(time);
    tooltip.style.left = `${toPercent(time, state.clip.duration)}%`;
    tooltip.classList.add("vc-visible");
  }

  function hideTooltip() {
    dom.byId(TOOLTIP_ID)?.classList.remove("vc-visible");
  }

  function setOpen(open) {
    dom.byId(WRAP_ID)?.classList.toggle("vc-open", open);
  }

  // Positions the track right above the icon row, in the same slot YouTube's own progress
  // bar sits in (hidden while the panel is open, so there's one bar, not two stacked).
  // .ytp-chrome-bottom's box is used rather than .ytp-progress-bar-container's, because
  // YouTube collapses that container down to a thin line flush with the player's bottom
  // edge while controls are auto-hidden - reading its rect at the wrong moment put our
  // (taller) track right on top of the icon row once controls became visible again.
  // .ytp-chrome-bottom's box stays stable across that hide/show transition.
  function position() {
    const wrap = dom.byId(WRAP_ID);
    const player = dom.findPlayer();
    if (!wrap || !player) return;

    const controlBar = dom.findControlBar();
    const bottomOffset = controlBar
      ? Math.max(
          MIN_BOTTOM_OFFSET_PX,
          player.getBoundingClientRect().bottom - controlBar.getBoundingClientRect().top + CONTROLS_GAP_PX
        )
      : FALLBACK_BOTTOM_OFFSET_PX;
    wrap.style.bottom = `${bottomOffset}px`;
  }

  // YouTube can re-create the player container, so the track is re-parented, not rebuilt.
  function attach(wrap) {
    const parent = dom.findPlayer() ?? document.body;
    if (wrap.parentElement !== parent) parent.appendChild(wrap);
  }

  function createWrap() {
    const wrap = document.createElement("div");
    wrap.id = WRAP_ID;
    wrap.innerHTML = `
      <div id="vc-track"></div>
      <div id="${RANGE_ID}"></div>
      <div id="${START_HANDLE_ID}" class="vc-handle"></div>
      <div id="${END_HANDLE_ID}" class="vc-handle"></div>
      <div id="${TOOLTIP_ID}"></div>
    `;
    return wrap;
  }

  /**
   * Idempotent. Listeners are wired only when the elements are created: YouTube's own JS
   * fights back and the mount loop calls this every second, so wiring on every call would
   * stack duplicate handlers on the same, still-alive elements.
   */
  function build() {
    const existing = dom.byId(WRAP_ID);
    if (existing) {
      attach(existing);
      return;
    }

    const wrap = createWrap();
    attach(wrap);
    VC.drag.install({
      trackEl: wrap,
      startHandleEl: dom.byId(START_HANDLE_ID),
      endHandleEl: dom.byId(END_HANDLE_ID),
      rangeEl: dom.byId(RANGE_ID),
    });
    window.addEventListener("resize", position);
    document.addEventListener("fullscreenchange", position);
  }

  VC.track = Object.freeze({ build, render, position, setOpen, showTooltip, hideTooltip });
})();
