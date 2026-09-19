(() => {
  /** Redraws everything that depends on state.clip: the track and the panel readout. */
  function refresh() {
    VC.track.render();
    VC.panel.renderSummary();
  }

  VC.view = Object.freeze({ refresh });
})();
