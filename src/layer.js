// Where the in-player UI (trigger button, track) is attached. On desktop that's the player
// itself. On the mobile site (m.youtube.com), the player's tap-catching controls overlay
// sits above anything placed inside #movie_player and swallows every tap, so the UI goes
// in a fixed layer on document.body that follows the player's on-screen box instead.
(() => {
  const { dom } = VC;

  const LAYER_ID = "vc-layer";
  let pendingFrame = 0;

  function sync() {
    pendingFrame = 0;
    const layer = dom.byId(LAYER_ID);
    if (!layer) return;
    const rect = dom.findPlayer()?.getBoundingClientRect();
    if (!rect || !(rect.height > 0)) {
      layer.style.display = "none";
      return;
    }
    Object.assign(layer.style, {
      display: "",
      top: `${rect.top}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }

  const scheduleSync = () => {
    if (!pendingFrame) pendingFrame = requestAnimationFrame(sync);
  };

  function createLayer() {
    const layer = document.createElement("div");
    layer.id = LAYER_ID;
    document.body.appendChild(layer);
    // Capture phase: m.youtube.com scrolls inner containers as well as the window.
    window.addEventListener("scroll", scheduleSync, { capture: true, passive: true });
    window.addEventListener("resize", scheduleSync);
    return layer;
  }

  /**
   * Idempotent; the mount loop calls it every second, which also re-syncs the layer with
   * player size changes that fire no scroll/resize event.
   * @returns {Element|null} the element in-player UI should be appended to
   */
  function host() {
    if (!dom.isMobileSite()) return dom.findPlayer();
    const layer = dom.byId(LAYER_ID) ?? createLayer();
    sync();
    return layer;
  }

  VC.layer = Object.freeze({ host });
})();
