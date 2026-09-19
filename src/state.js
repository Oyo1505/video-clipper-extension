// The only mutable state of the extension.
//
//   video       the <video> element the open panel is editing, null while closed
//   clip        the current selection { start, end, duration } in absolute video seconds,
//               null while the panel is closed (so `clip !== null` means "panel is open").
//               Treated as immutable: replace it with the result of a selection.* function.
//   isRecording true while a clip is being captured (blocks a second export)
VC.state = {
  video: null,
  clip: null,
  isRecording: false,
};
