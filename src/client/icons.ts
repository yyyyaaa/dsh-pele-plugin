/** Glyph paths drawn on a 16×16 grid with `currentColor`, so they inherit the header tone. */
export const ICON_PATHS = {
  diagram: 'M2 3.5h4.5v3H2zM9.5 9.5H14v3H9.5zM6.5 5h2.5a1 1 0 0 1 1 1v3.5',
  copy: 'M10 5.5V3.9a1.4 1.4 0 0 0-1.4-1.4H3.9a1.4 1.4 0 0 0-1.4 1.4v5.2a1.4 1.4 0 0 0 1.4 1.4H5.5M5.5 5.5h8v8h-8z',
  check: 'M3 8.5 6.2 11.7 13 5',
  expand: 'M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4',
  close: 'M3.5 3.5l9 9m0-9l-9 9',
} as const

export type IconName = keyof typeof ICON_PATHS
