/**
 * Loading and configuring Pele.
 *
 * Pele ships as its own package-local chunk, so the browser only downloads it
 * once, on the first diagram, and one failed fetch does not poison later cards.
 */
import type { MountOptions, Mounted, ZoomOptions } from 'pele'
import type { ModuleRequire, Translate } from './types.ts'

/** Path of the chunk relative to this bundle, as `require.async` resolves it. */
const CHUNK = './client.pele.js'

/** The slice of the Pele module this plugin calls; the rest of Pele stays in the chunk. */
export interface PeleModule {
  mount(element: HTMLElement, source: string, options?: MountOptions): Mounted
  detectType(source: string): string | null
}

/** The renderer seam: the UI never touches `require` or mount options directly. */
export interface Renderer {
  load(): Promise<PeleModule>
  mountOptions(t: Translate): MountOptions
}

/** Reject a chunk that does not carry the two functions the card needs. */
function isPeleModule(value: unknown): value is PeleModule {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<PeleModule>
  return typeof candidate.mount === 'function' && typeof candidate.detectType === 'function'
}

/**
 * Pele owns zoom: `always` keeps its in/out/reset knobs mounted, and pan, pinch,
 * wheel, and keyboard gestures come with them.
 * @param t - the plugin's translator.
 * @returns the zoom configuration shared by the card and the fullscreen view.
 */
function zoomOptions(t: Translate): ZoomOptions {
  return {
    always: true,
    maxScale: 4,
    labels: { zoomIn: t('zoom.in'), zoomOut: t('zoom.out'), reset: t('zoom.reset') },
  }
}

/**
 * Build the renderer for one plugin instance.
 * @param require - the module loader's `require`, so the chunk resolves beside this bundle.
 * @returns a renderer whose module promise is shared across every card.
 */
export function createRenderer(require: ModuleRequire): Renderer {
  let pending: Promise<PeleModule> | undefined

  return {
    load(): Promise<PeleModule> {
      if (pending === undefined) {
        pending = require.async(CHUNK).then((loaded) => {
          if (!isPeleModule(loaded)) {
            throw new Error('mermaid: the Pele chunk did not export `mount` and `detectType`.')
          }
          return loaded
        }, (error: unknown) => {
          pending = undefined
          throw error
        })
      }
      return pending
    },
    mountOptions(t: Translate): MountOptions {
      return { links: false, images: false, zoom: zoomOptions(t) }
    },
  }
}
