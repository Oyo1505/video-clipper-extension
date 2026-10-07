// Entry point. YouTube is a SPA with no reliable single mount point, so the UI is
// (re)mounted by a polling loop; every mount function is idempotent.
(() => {
  const { state } = VC;
  const { POLL_INTERVAL_MS } = VC.config;

  // The content script is injected on every YouTube page, because match patterns are only
  // evaluated on full page loads: arriving on a video via YouTube's SPA navigation (from
  // the home page, search...) would otherwise never inject anything.
  const isWatchPage = () => location.pathname === "/watch";

  function mountUi() {
    if (!isWatchPage()) return;
    VC.fab.ensure();
    VC.panel.build();
    VC.track.build();
  }

  function watchForNavigation() {
    let lastHref = location.href;
    setInterval(() => {
      if (location.href !== lastHref) {
        lastHref = location.href;
        VC.panel.close();
        state.video = null;
      }
      mountUi();
    }, POLL_INTERVAL_MS);
  }

  // When the extension is reloaded or auto-updated, the previous instance's UI stays in
  // the page with dead listeners, and the idempotent builders would adopt it as-is.
  function removeStaleUi() {
    for (const id of ["vc-fab", "vc-panel", "vc-track-wrap", "vc-layer"]) {
      document.getElementById(id)?.remove();
    }
  }

  removeStaleUi();
  VC.shortcuts.install();
  mountUi();
  watchForNavigation();
})();
