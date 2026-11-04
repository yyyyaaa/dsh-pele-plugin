# Changelog

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
