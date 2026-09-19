// Pointer dragging for the two trim handles and the range between them.
(() => {
  const { state } = VC;
  const { clamp } = VC.util;
  const { selection } = VC;

  // Time under the pointer, in absolute video seconds; null while the track has no width.
  function timeAtPointer(trackEl, clientX) {
    const rect = trackEl.getBoundingClientRect();
    if (!(rect.width > 0)) return null;
    return clamp((clientX - rect.left) / rect.width, 0, 1) * state.clip.duration;
  }

  function releaseCapture(el, pointerId) {
    try {
      el.releasePointerCapture(pointerId);
    } catch {
      // pointer may already be released (e.g. capture lost mid-drag)
    }
  }

  // Shared pointer-drag plumbing. `begin(grabTime)` runs at pointerdown and returns
  // `moveTo(pointerTime)`, which updates state.clip and returns the time to show in the
  // tooltip and seek the player to.
  function makeDraggable(el, trackEl, begin) {
    el.addEventListener("pointerdown", (downEvent) => {
      if (!state.clip) return;
      downEvent.preventDefault();
      downEvent.stopPropagation();

      const moveTo = begin(timeAtPointer(trackEl, downEvent.clientX) ?? 0);
      el.setPointerCapture(downEvent.pointerId);
      el.classList.add("vc-dragging");
      state.video?.pause();

      const onMove = (moveEvent) => {
        if (!state.clip) {
          onUp(moveEvent);
          return;
        }
        const pointerTime = timeAtPointer(trackEl, moveEvent.clientX);
        if (pointerTime === null) return;
        const shownTime = moveTo(pointerTime);
        VC.view.refresh();
        VC.track.showTooltip(shownTime);
        if (state.video) state.video.currentTime = shownTime;
      };

      const onUp = (upEvent) => {
        releaseCapture(el, upEvent.pointerId);
        el.classList.remove("vc-dragging");
        VC.track.hideTooltip();
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  }

  function dragBoundary(handleEl, trackEl, which) {
    makeDraggable(handleEl, trackEl, () => (pointerTime) => {
      state.clip = selection.setBound(state.clip, which, pointerTime);
      return state.clip[which];
    });
  }

  // Dragging inside the highlighted range (between the two handles) slides the whole
  // selection - both boundaries together, duration unchanged - the way you'd drag a trim
  // window along a timeline. Whatever point was under the pointer at pointerdown stays
  // under the pointer as it moves.
  function dragWholeSelection(rangeEl, trackEl) {
    makeDraggable(rangeEl, trackEl, (grabTime) => {
      const grabOffset = clamp(grabTime - state.clip.start, 0, selection.spanOf(state.clip));
      return (pointerTime) => {
        state.clip = selection.slideTo(state.clip, pointerTime - grabOffset);
        return state.clip.start;
      };
    });
  }

  /** Wires the drag behaviour. Call exactly once per set of elements. */
  function install({ trackEl, startHandleEl, endHandleEl, rangeEl }) {
    dragBoundary(startHandleEl, trackEl, "start");
    dragBoundary(endHandleEl, trackEl, "end");
    dragWholeSelection(rangeEl, trackEl);
  }

  VC.drag = Object.freeze({ install });
})();
