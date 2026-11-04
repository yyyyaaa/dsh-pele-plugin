/**
 * Glyph paths drawn with `currentColor`, so they inherit the header tone.
 *
 * Each entry carries its own grid: the 16-unit glyphs are drawn for this plugin,
 * the 24-unit ones are Pele's own control glyphs, kept at their native scale.
 */
export const ICONS = {
  diagram: { box: 16, d: 'M2 3.5h4.5v3H2zM9.5 9.5H14v3H9.5zM6.5 5h2.5a1 1 0 0 1 1 1v3.5' },
  copy: { box: 16, d: 'M10 5.5V3.9a1.4 1.4 0 0 0-1.4-1.4H3.9a1.4 1.4 0 0 0-1.4 1.4v5.2a1.4 1.4 0 0 0 1.4 1.4H5.5M5.5 5.5h8v8h-8z' },
  check: { box: 16, d: 'M3 8.5 6.2 11.7 13 5' },
  expand: { box: 16, d: 'M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4' },
  close: { box: 16, d: 'M3.5 3.5l9 9m0-9l-9 9' },
  zoomIn: { box: 24, d: 'M5 12h14M12 5v14' },
  zoomOut: { box: 24, d: 'M5 12h14' },
  reset: { box: 24, d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5' },
} as const

export type IconName = keyof typeof ICONS
