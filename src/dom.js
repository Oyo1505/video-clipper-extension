// Lookups into YouTube's own DOM, kept in one place since these selectors are the part
// most likely to break when YouTube changes its player.
(() => {
  const byId = (id) => document.getElementById(id);

  // m.youtube.com (served to phones, e.g. Firefox for Android) has a different player DOM.
  const isMobileSite = () => location.hostname === "m.youtube.com";

  function findVideo() {
    return document.querySelector("video.html5-main-video") || document.querySelector("video");
  }

  function findPlayer() {
    return byId("movie_player") || document.querySelector(".html5-video-player");
  }

  function findInPlayer(selector) {
    return findPlayer()?.querySelector(selector) ?? null;
  }

  // YouTube's right-side control cluster (next to settings/fullscreen), where extensions
  // like SponsorBlock slot their buttons.
  function findRightControls() {
    return findInPlayer(".ytp-right-controls");
  }

  function findControlBar() {
    return findInPlayer(".ytp-chrome-bottom");
  }

  // Hides YouTube's own scrubber while ours is shown, so there's a single bar in that
  // slot instead of two stacked on top of each other.
  function setNativeProgressBarHidden(hidden) {
    const progressBar = findInPlayer(".ytp-progress-bar-container");
    if (progressBar) progressBar.style.display = hidden ? "none" : "";
  }

  // Keeps taps on our UI inside the player from also reaching the mobile player, which
  // would toggle its controls overlay or pause the video. Call once per element.
  function isolateFromPlayer(el) {
    if (!isMobileSite()) return;
    for (const type of ["click", "pointerdown", "touchstart", "touchend", "mousedown", "mouseup"]) {
      el.addEventListener(type, (event) => event.stopPropagation());
    }
  }

  VC.dom = Object.freeze({
    byId,
    isMobileSite,
    findVideo,
    findPlayer,
    findRightControls,
    findControlBar,
    setNativeProgressBarHidden,
    isolateFromPlayer,
  });
})();
