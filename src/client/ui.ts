/**
 * The view layer.
 *
 * `createUi` receives React from the module loader rather than importing it,
 * which keeps the bundle's only runtime dependency an injected seed. Components
 * are created once per plugin instance and share the closure's `h` and renderer.
 */
import type * as ReactTypes from 'react'
import type { Component, ToolBlock, ToolBlockSettled, Translate } from './types.ts'
import { parseArguments } from './json.ts'
import type { PeleModule, Renderer } from './renderer.ts'
import type { TurnLike } from './dataset.ts'
import { diagramsOf } from './dataset.ts'
import type { IconName } from './icons.ts'
import { ICON_PATHS } from './icons.ts'

/** Props the keyed `tool.call.toolview` slot passes to one call view. */
export interface ToolViewProps {
  readonly block: ToolBlock
  readonly t: Translate
}

/** Props the `conversation.chat.turnTail` slot passes to one closing turn. */
export interface TurnTailProps {
  readonly turn?: TurnLike
  readonly t: Translate
}

/** Props the `shell.overlay` slot passes to the frame-level entry. */
export interface OverlayProps {
  readonly t: Translate
}

/** The three views this plugin contributes to the page. */
export interface Ui {
  readonly MermaidCard: Component<ToolViewProps>
  readonly DiagramTail: Component<TurnTailProps>
  readonly FullscreenOverlay: Component<OverlayProps>
}

/**
 * What one tool call should show, derived before any rendering.
 *
 * Keeping this out of the component means the partial-argument, failure, and
 * ready cases are one pure function instead of three branches interleaved with
 * markup.
 */
type CardState =
  | { readonly kind: 'preparing' }
  | { readonly kind: 'failed'; readonly source: string; readonly message: string }
  | { readonly kind: 'ready'; readonly source: string; readonly title: string }

/** Which diagram the frame-level overlay is showing. */
interface FullscreenView {
  readonly source: string
  readonly title: string
}

/** Cross-slot store: the card and the overlay are separate entries. */
interface FullscreenStore {
  subscribe(listener: () => void): () => void
  get(): FullscreenView | null
  open(view: FullscreenView): void
  close(): void
}

/**
 * Build one overlay store.
 *
 * The card and the `shell.overlay` entry cannot share React state, so they share
 * this store instead; it is created per plugin instance and dies with it.
 */
function createFullscreenStore(): FullscreenStore {
  let current: FullscreenView | null = null
  const listeners = new Set<() => void>()
  const emit = () => {
    for (const listener of listeners) listener()
  }
  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    get() {
      return current
    },
    open(view) {
      current = view
      emit()
    },
    close() {
      if (current === null) return
      current = null
      emit()
    },
  }
}

/** Human-readable text for a thrown value. */
function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Flatten a settled tool result into the text a failed card shows. */
function resultText(block: ToolBlockSettled): string {
  const parts: string[] = []
  for (const item of block.content ?? []) {
    parts.push(typeof item.text === 'string' ? item.text : JSON.stringify(item, null, 2))
  }
  return parts.join('\n')
}

/**
 * Derive what one call should render.
 *
 * Until the call settles, `argsRaw` is still partial JSON and is parsed
 * tolerantly, which is why a half-written argument reads as "preparing" rather
 * than as a failure.
 * @param block - the tool row's current stage.
 * @returns the card state, independent of React.
 */
function cardState(block: ToolBlock): CardState {
  const settled = 'kind' in block
  const args = parseArguments(settled ? block.call?.argsRaw ?? '' : block.argsRaw ?? '')
  const source = typeof args.source === 'string' ? args.source.trim() : ''
  const title = typeof args.title === 'string' ? args.title.trim() : ''

  if (settled && (block.isError === true || block.error !== undefined)) {
    return { kind: 'failed', source, message: resultText(block) }
  }
  return source === ''
    ? { kind: 'preparing' }
    : { kind: 'ready', source, title }
}

/**
 * Build the views for one plugin instance.
 * @param React - the React runtime the module loader provides.
 * @param renderer - the Pele seam: chunk loading and mount options.
 * @returns the components registered into Harness slots.
 */
export function createUi(React: typeof ReactTypes, renderer: Renderer): Ui {
  const h = React.createElement
  const fullscreen = createFullscreenStore()

  /** A 16×16 glyph drawn with `currentColor`. */
  function Icon({ name, size = 12 }: { readonly name: IconName; readonly size?: number }) {
    return h('svg', {
      className: 'dsh-mermaid-icon',
      width: size,
      height: size,
      viewBox: '0 0 16 16',
      fill: 'none',
      'aria-hidden': 'true',
    }, h('path', {
      d: ICON_PATHS[name],
      stroke: 'currentColor',
      strokeWidth: 1.3,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
    }))
  }

  /** A header icon button; every action in this plugin is one of these. */
  function ActionButton({ label, icon, attribute, onClick }: {
    readonly label: string
    readonly icon: IconName
    readonly attribute: Record<string, string>
    readonly onClick: () => void
  }) {
    return h('button', {
      type: 'button',
      className: 'dsh-mermaid-action',
      title: label,
      'aria-label': label,
      onClick,
      ...attribute,
    }, h(Icon, { name: icon }))
  }

  /** Resolve the Pele chunk once per card, keeping a failure visible. */
  function usePele(): { readonly pele: PeleModule | undefined; readonly error: string | undefined } {
    const [pele, setPele] = React.useState<PeleModule | undefined>(undefined)
    const [error, setError] = React.useState<string | undefined>(undefined)
    React.useEffect(() => {
      let live = true
      renderer.load().then(
        (module) => {
          if (live) setPele(module)
        },
        (reason: unknown) => {
          if (live) setError(describe(reason))
        },
      )
      return () => {
        live = false
      }
    }, [])
    return { pele, error }
  }

  /** Copy the Mermaid source, with a short-lived confirmation. */
  function CopyButton({ source, t }: { readonly source: string; readonly t: Translate }) {
    const [copied, setCopied] = React.useState(false)
    const timer = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    React.useEffect(() => () => {
      if (timer.current !== undefined) clearTimeout(timer.current)
    }, [])
    const copy = () => {
      const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
      if (clipboard === undefined) return
      clipboard.writeText(source).then(() => {
        setCopied(true)
        if (timer.current !== undefined) clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), 1400)
      }, () => {})
    }
    return h('button', {
      type: 'button',
      className: 'dsh-mermaid-action dsh-mermaid-copy',
      title: t('card.copy'),
      'aria-label': t('card.copy'),
      onClick: copy,
    }, h(Icon, { name: copied ? 'check' : 'copy' }), h('span', null, copied ? t('card.copied') : t('card.copy')))
  }

  /** Mount one Pele diagram into a stable container. */
  function DiagramBody({ pele, source, t, fill = false, fit = false }: {
    readonly pele: PeleModule
    readonly source: string
    readonly t: Translate
    readonly fill?: boolean
    readonly fit?: boolean
  }) {
    const host = React.useRef<HTMLDivElement | null>(null)
    React.useEffect(() => {
      const element = host.current
      if (element === null) return undefined
      element.replaceChildren()
      /** Pele reports a failed parse through `onError` rather than by throwing. */
      const show = (error: unknown) => {
        element.textContent = describe(error)
        element.dataset.peleError = ''
      }
      let mounted: ReturnType<PeleModule['mount']> | undefined
      try {
        mounted = pele.mount(element, source, renderer.mountOptions(t))
        if (mounted.error !== undefined) {
          show(mounted.error)
        } else if (fit && mounted.zoom !== undefined) {
          // Fullscreen has room the inline card never gets; use it instead of
          // leaving a small diagram at its natural size in a large viewport.
          const natural = mounted.result?.width ?? 0
          const room = element.clientWidth
          if (natural > 0 && room > natural * 1.05) {
            try {
              mounted.zoom.zoomTo(Math.min(2, room / natural))
            } catch {}
          }
        }
      } catch (error) {
        show(error)
      }
      return () => {
        try {
          mounted?.destroy()
        } catch {}
      }
    }, [pele, source, t, fit])
    return h('div', {
      ref: host,
      className: fill ? 'dsh-mermaid-body dsh-mermaid-body-fill' : 'dsh-mermaid-body',
    })
  }

  /** Card chrome shared by every state: title row, type chip, actions, body. */
  function Frame({ title, source, t, chip = null, actions = null, body, panel = false }: {
    readonly title: string
    readonly source: string
    readonly t: Translate
    readonly chip?: string | null
    readonly actions?: ReactTypes.ReactNode
    readonly body: ReactTypes.ReactNode
    readonly panel?: boolean
  }) {
    return h('div', {
      className: panel ? 'dsh-mermaid-scope dsh-mermaid-panel' : 'dsh-mermaid-scope dsh-mermaid-card',
      // Only the card is a tool row; the overlay panel is not.
      'data-tool': panel ? undefined : 'mermaid',
    },
      h('div', { className: 'dsh-mermaid-head' },
        h(Icon, { name: 'diagram', size: 14 }),
        h('span', { className: 'dsh-mermaid-title' }, title),
        chip === null ? null : h('span', { className: 'dsh-mermaid-chip' }, chip),
        h('span', { className: 'dsh-mermaid-actions' },
          actions,
          source === '' ? null : h(CopyButton, { source, t }))),
      body)
  }

  /** One drawable diagram: resolves Pele, then renders the card or the overlay panel. */
  function DiagramView({ source, title, t, panel = false }: {
    readonly source: string
    readonly title: string
    readonly t: Translate
    readonly panel?: boolean
  }) {
    const { pele, error } = usePele()
    const chip = pele === undefined ? null : pele.detectType(source) ?? 'mermaid'
    const body = error !== undefined
      ? h('div', { className: 'dsh-mermaid-note dsh-mermaid-note-error' }, `${t('card.rendererFailed')} ${error}`)
      : pele === undefined
        ? h('div', { className: 'dsh-mermaid-note', role: 'status' }, t('card.rendererLoading'))
        : h(DiagramBody, { pele, source, t, fill: panel, fit: panel })

    const actions = panel
      ? h(ActionButton, {
        label: t('card.exitFullscreen'),
        icon: 'close',
        attribute: { 'data-mermaid-close': '' },
        onClick: () => fullscreen.close(),
      })
      : h(ActionButton, {
        label: t('card.fullscreen'),
        icon: 'expand',
        attribute: { 'data-mermaid-fullscreen': '' },
        onClick: () => fullscreen.open({ source, title }),
      })

    return h(Frame, { title: title || t('card.title'), source, t, chip, actions, body, panel })
  }

  /**
   * The live tool view.
   *
   * This is what runs while the turn streams. After the turn completes its
   * process rows fold, which is why `DiagramTail` renders a second copy.
   */
  function MermaidCard({ block, t }: ToolViewProps) {
    const state = cardState(block)

    if (state.kind === 'failed') {
      return h(Frame, {
        title: t('card.error'),
        source: state.source,
        t,
        body: h('pre', { className: 'dsh-mermaid-error' }, state.message || t('card.error')),
      })
    }
    if (state.kind === 'preparing') {
      return h(Frame, {
        title: t('card.title'),
        source: '',
        t,
        body: h('div', { className: 'dsh-mermaid-note', role: 'status' }, t('card.preparing')),
      })
    }
    return h(DiagramView, { source: state.source, title: state.title, t })
  }

  /** The closing turn's diagrams, rendered where they stay visible. */
  function DiagramTail({ turn, t }: TurnTailProps) {
    const diagrams = diagramsOf(turn)
    if (diagrams.length === 0) return null
    return h(React.Fragment, null, diagrams.map((diagram) => h(DiagramView, {
      key: diagram.callId,
      source: diagram.source,
      title: diagram.title,
      t,
    })))
  }

  /**
   * Frame-level fullscreen view.
   *
   * `shell.overlay` is the seat above every column, so the diagram is not clipped
   * by the transcript's scroll container and does not fight the composer for
   * stacking order. Escape, the close action, and a backdrop click all close it;
   * focus moves into the dialog and returns to the trigger on close.
   */
  function FullscreenOverlay({ t }: OverlayProps) {
    const view = React.useSyncExternalStore(fullscreen.subscribe, fullscreen.get)
    const dialog = React.useRef<HTMLDivElement | null>(null)
    const restoreTo = React.useRef<HTMLElement | null>(null)

    React.useEffect(() => {
      if (view === null) return undefined
      const active = document.activeElement
      restoreTo.current = active instanceof HTMLElement ? active : null
      dialog.current?.focus()

      const onKey = (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return
        event.preventDefault()
        event.stopPropagation()
        fullscreen.close()
      }
      document.addEventListener('keydown', onKey, true)
      const root = document.documentElement
      const previous = root.style.overflow
      root.style.overflow = 'hidden'
      return () => {
        document.removeEventListener('keydown', onKey, true)
        root.style.overflow = previous
        restoreTo.current?.focus()
      }
    }, [view])

    if (view === null) return null
    const title = view.title || t('card.title')
    return h('div', {
      ref: dialog,
      className: 'dsh-mermaid-overlay',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': title,
      tabIndex: -1,
      onClick: (event: ReactTypes.MouseEvent<HTMLDivElement>) => {
        if (event.target === event.currentTarget) fullscreen.close()
      },
    }, h(DiagramView, { source: view.source, title: view.title, t, panel: true }))
  }

  return { MermaidCard, DiagramTail, FullscreenOverlay }
}
