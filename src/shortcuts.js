// I / O keys mark the start / end at the playhead. Only for long videos, where dragging
// a handle on the full-length track is impractical.
(() => {
  const { state, selection } = VC;

  const EDITABLE_TAGS = /^(INPUT|TEXTAREA|SELECT)$/;

  const isTypingTarget = (target) =>
    Boolean(target) && (target.isContentEditable || EDITABLE_TAGS.test(target.tagName));

  const hasModifier = (event) => event.ctrlKey || event.metaKey || event.altKey;

  const BOUND_BY_KEY = Object.freeze({ i: "start", o: "end" });

  function onKeyDown(event) {
    if (!VC.panel.isOpen() || !selection.isLongVideo(state.clip)) return;
    if (hasModifier(event) || isTypingTarget(event.target)) return;
    const which = BOUND_BY_KEY[event.key.toLowerCase()];
    if (!which) return;

    event.preventDefault();
    event.stopPropagation();
    VC.marks.markAtPlayhead(which);
  }

  /** Call once. Capture phase + stopPropagation: YouTube binds "i" to the miniplayer, which must not fire while we own the key. */
  function install() {
    document.addEventListener("keydown", onKeyDown, true);
  }

  VC.shortcuts = Object.freeze({ install });
})();
