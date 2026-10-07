// Two-finger pinch on the track (touch screens) resizes the selection around its middle:
// spreading the fingers apart lengthens the clip, pinching them together shortens it.
(() => {
  const { state, selection } = VC;
  const { MIN_PINCH_DISTANCE_PX } = VC.config;

  // clientX of each finger currently down on the track, by pointerId.
  const fingers = new Map();
  // Selection and finger gap when the second finger landed; null while not pinching.
  let gesture = null;

  function fingerGap() {
    const [a, b] = fingers.values();
    return Math.max(MIN_PINCH_DISTANCE_PX, Math.abs(a - b));
  }

  function onDown(event) {
    if (event.pointerType !== "touch" || !state.clip) return;
    fingers.set(event.pointerId, event.clientX);
    if (fingers.size !== 2) return;
    const { clip } = state;
    gesture = { gap: fingerGap(), span: selection.spanOf(clip), center: (clip.start + clip.end) / 2 };
    VC.track.hideTooltip();
  }

  function onMove(event) {
    if (!fingers.has(event.pointerId)) return;
    fingers.set(event.pointerId, event.clientX);
    if (!gesture || !state.clip) return;
    const span = gesture.span * (fingerGap() / gesture.gap);
    state.clip = selection.resizeAround(state.clip, gesture.center, span);
    VC.view.refresh();
  }

  function onUp(event) {
    fingers.delete(event.pointerId);
    if (fingers.size < 2) gesture = null;
  }

  /** True while two fingers are pinching; one-finger drags stand down meanwhile. */
  const isActive = () => gesture !== null;

  /**
   * Call exactly once per track element. Capture phase, so fingers landing on a handle or
   * the range (whose drag listeners stop propagation) are counted too.
   */
  function install(trackEl) {
    trackEl.addEventListener("pointerdown", onDown, true);
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  }

  VC.pinch = Object.freeze({ install, isActive });
})();
