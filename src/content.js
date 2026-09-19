// Entry point. YouTube is a SPA with no reliable single mount point, so the UI is
// (re)mounted by a polling loop; every mount function is idempotent.
(() => {
  const { state } = VC;
  const { POLL_INTERVAL_MS } = VC.config;

  function mountUi() {
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

  VC.shortcuts.install();
  mountUi();
  watchForNavigation();
})();
