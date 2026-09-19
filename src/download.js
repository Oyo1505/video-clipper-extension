(() => {
  const { REVOKE_URL_DELAY_MS, FILENAME_TITLE_MAX_LENGTH } = VC.config;

  const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/g;

  function buildFilename() {
    const title = (document.title || "clip").replace(INVALID_FILENAME_CHARS, "_").slice(0, FILENAME_TITLE_MAX_LENGTH);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${title}_${timestamp}.webm`;
  }

  /** Triggers a browser download of `blob` under a name derived from the page title. */
  function saveBlob(blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildFilename();
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), REVOKE_URL_DELAY_MS);
  }

  VC.download = Object.freeze({ saveBlob });
})();
