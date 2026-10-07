// The trigger button, slotted into YouTube's own right-side control cluster (next to
// settings/fullscreen) the way SponsorBlock and similar extensions do, instead of a
// floating button detached from the player.
(() => {
  const { dom } = VC;

  const FAB_ID = "vc-fab";
  const LABEL = "Create a clip";

  // The mobile site (m.youtube.com, e.g. Firefox for Android) has no .ytp-right-controls,
  // and its controls overlay is shown/hidden on tap; the button floats over the player.
  function attach(fab) {
    if (dom.isMobileSite()) {
      const host = VC.layer.host();
      if (host && fab.parentElement !== host) host.appendChild(fab);
      return;
    }
    const controls = dom.findRightControls();
    if (controls && fab.parentElement !== controls) {
      controls.insertBefore(fab, controls.firstChild);
    }
  }

  function create() {
    const fab = document.createElement("button");
    fab.id = FAB_ID;
    fab.className = dom.isMobileSite() ? "vc-fab-floating" : "ytp-button";
    fab.title = LABEL;
    fab.setAttribute("aria-label", LABEL);
    fab.textContent = "🎬";
    fab.addEventListener("click", VC.panel.toggle);
    dom.isolateFromPlayer(fab);
    return fab;
  }

  /**
   * Idempotent. YouTube periodically rewrites .ytp-right-controls' innerHTML, which can
   * evict the button, so it is re-attached (or re-created if it was dropped) on every call.
   */
  function ensure() {
    attach(dom.byId(FAB_ID) ?? create());
  }

  VC.fab = Object.freeze({ ensure });
})();
