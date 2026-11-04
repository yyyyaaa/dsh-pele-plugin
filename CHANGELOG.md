# Changelog

## 0.2.1 — 2026-11-04

### Fixed

- The turn-data definition now claims only `turn/start` and `mermaid` tool calls. It used to match every `tool/result` in the session, which is the widest possible claim on the conversation event stream and could collide with the assembler when a turn's start was not in the loaded window.
- The definition publishes nothing for turns without diagrams, and compares published diagrams by value, so a replay window that rebuilds equal data does not look like a change.
- `start` no longer throws when handed an event that is not `turn/start`.
- Every view the plugin registers is wrapped in an error boundary with a local fallback, so a rendering failure inside a card can no longer take the transcript with it.

## 0.2.0 — 2026-11-04

### Changed

- Every diagram control now lives in a single toolbar at the top right of the card: zoom out, zoom in, reset, fullscreen, and copy, all the same 24px icon button. Pele's floating controls are disabled.
- The copy action is always visible instead of fading in on hover, so the header no longer reserves blank space.
- The fullscreen view scrolls tall diagrams and centers the diagram in the frame.

## 0.1.0 — 2026-11-04

Initial release.

### Added

- A `mermaid` tool that validates Mermaid source with Pele on the Host and returns the diagram type and laid-out size, with failures reported as line and column.
- A keyed tool view that renders the diagram as a themed SVG card while the turn runs.
- A turn-data Definition and turn-tail view that keep the diagrams visible after a completed turn folds its process rows.
- A frame-level fullscreen view with focus handling, Escape and backdrop dismissal, and scroll locking.
- Pele's zoom knobs on every card: zoom in, zoom out, and reset, with drag-to-pan, pinch, wheel, and keyboard gestures.
- Localized card labels and display metadata in English and Chinese.
- A standing prompt instruction that steers models to the tool instead of fenced Mermaid blocks.
