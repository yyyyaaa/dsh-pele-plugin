/**
 * Loading and configuring Pele.
 *
 * Pele ships as its own package-local chunk, so the browser only downloads it
 * once, on the first diagram, and one failed fetch does not poison later cards.
 */
import type { MountOptions, Mounted } from 'pele'
import type { ModuleRequire } from './types.ts'

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
  mountOptions(): MountOptions
}

/** Reject a chunk that does not carry the two functions the card needs. */
function isPeleModule(value: unknown): value is PeleModule {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<PeleModule>
  return typeof candidate.mount === 'function' && typeof candidate.detectType === 'function'
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
    mountOptions(): MountOptions {
      // Pele keeps the gestures but draws no controls of its own: every control
      // this plugin offers lives in one toolbar, so it cannot scatter.
      // `always` also lifts Pele's "only zoom a diagram that overflows" guard,
      // which would otherwise make the toolbar buttons dead on a small diagram.
      return { links: false, images: false, zoom: { controls: false, always: true, maxScale: 4 } }
    },
  }
}
