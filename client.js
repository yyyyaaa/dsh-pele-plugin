/**
 * Client half of `@local/mermaid-pele`.
 *
 * Registers the keyed `mermaid` tool view: one card per call that mounts Pele
 * into the chat flow and renders the source the model passed. Pele itself lives
 * in the package-local `client.pele.js` chunk so a page that never draws a
 * diagram never downloads or executes it.
 */
window.__ModuleLoader__.load({
  id: '@local/mermaid-pele',
  factory: (require) => {
    const React = require('react')
    const h = React.createElement

    /** Dictionary namespace registered with the Client locale service. */
    const NS = 'mermaid-pele'

    /** Palette mapping: Pele's CSS variables follow the live Harness theme. */
    const THEME_VARS = {
      '--pele-bg': 'var(--dsw-alias-bg-base, #ffffff)',
      '--pele-fg': 'var(--dsw-alias-label-primary, #1f1f1f)',
      '--pele-muted': 'var(--dsw-alias-label-secondary, #6e6e6e)',
      '--pele-line': 'var(--dsw-alias-label-secondary, #1f1f1f)',
      '--pele-surface': 'var(--dsw-alias-bg-layer-2, #f3f3f3)',
      '--pele-surface-alt': 'var(--dsw-alias-bg-layer-2, #e6e6e6)',
      '--pele-border': 'var(--dsw-alias-border-l2, #8a8a8a)',
      '--pele-accent': 'var(--dsw-alias-brand-primary, #5b7bd5)',
      '--pele-critical': 'var(--dsw-alias-state-error-primary, #e45756)',
      '--pele-error': 'var(--dsw-alias-state-error-primary, #e45756)',
    }

    const en = {
      'card.title': 'Mermaid diagram',
      'card.preparing': 'Preparing diagram…',
      'card.rendererLoading': 'Loading diagram renderer…',
      'card.rendererFailed': 'The diagram renderer could not load.',
      'card.copy': 'Copy Mermaid source',
      'card.copied': 'Copied',
      'card.error': 'Diagram failed',
      'card.fullscreen': 'Open fullscreen',
      'card.exitFullscreen': 'Close fullscreen',
      'zoom.in': 'Zoom in',
      'zoom.out': 'Zoom out',
      'zoom.reset': 'Reset zoom',
    }

    const zh = {
      'card.title': 'Mermaid 图表',
      'card.preparing': '正在准备图表…',
      'card.rendererLoading': '正在加载图表渲染器…',
      'card.rendererFailed': '图表渲染器加载失败。',
      'card.copy': '复制 Mermaid 源码',
      'card.copied': '已复制',
      'card.error': '图表渲染失败',
      'card.fullscreen': '全屏查看',
      'card.exitFullscreen': '关闭全屏',
      'zoom.in': '放大',
      'zoom.out': '缩小',
      'zoom.reset': '重置缩放',
    }

    const CARD_CSS = [
      '.dsh-mermaid-actions{opacity:0;transition:opacity .1s}',
      '.dsh-mermaid-card:hover .dsh-mermaid-actions,.dsh-mermaid-card:focus-within .dsh-mermaid-actions{opacity:1}',
      '.dsh-mermaid-body{overflow:auto;overscroll-behavior:contain;max-width:100%}',
      '.dsh-mermaid-body svg{display:block;margin:0 auto}',
      '.dsh-mermaid-body-fill{flex:1 1 auto;min-height:0;overflow:hidden;display:flex}',
      '.dsh-mermaid-body-fill>svg,.dsh-mermaid-body-fill>div{flex:1 1 auto;min-height:0}',
      '.dsh-mermaid-action:hover{background:var(--dsw-alias-interactive-bg-hover-solid,rgba(127,127,127,.12))}',
      '.dsh-mermaid-zoom button:hover{background:var(--dsw-alias-interactive-bg-hover-solid,rgba(127,127,127,.12))}',
      '@media (prefers-reduced-motion:reduce){.dsh-mermaid-actions{transition:none}}',
    ].join('')

    /** Actions sit at the end of the header row, after the chip. */
    const actionGroupStyle = {
      marginLeft: 'auto',
      flex: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2px',
    }

    /** Frame-wide fullscreen surface for one diagram. */
    const overlayStyle = {
      position: 'fixed',
      inset: 0,
      zIndex: 1000,
      boxSizing: 'border-box',
      padding: 'clamp(12px, 3vh, 32px)',
      background: 'color-mix(in srgb, var(--dsw-alias-bg-base) 88%, transparent)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      flexDirection: 'column',
    }

    /** The panel inside the overlay keeps the card's tokens and border. */
    const overlayPanelStyle = {
      flex: '1 1 auto',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '12px 14px 14px',
      boxSizing: 'border-box',
      border: '0.5px solid var(--dsw-alias-border-l1)',
      borderRadius: 'var(--dsw-radius-lg)',
      background: 'var(--dsw-alias-bg-layer-1)',
      color: 'var(--dsw-alias-label-primary)',
      ...THEME_VARS,
    }

    /** Shared card chrome: a quiet bordered surface that matches a tool card. */
    const cardStyle = {
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      margin: '4px 0',
      padding: '8px 10px 10px',
      border: '0.5px solid var(--dsw-alias-border-l1)',
      borderRadius: 'var(--dsw-radius-lg)',
      background: 'var(--dsw-alias-bg-layer-1, transparent)',
      color: 'var(--dsw-alias-label-primary)',
      boxSizing: 'border-box',
      maxWidth: '100%',
      fontFamily: 'inherit',
      ...THEME_VARS,
    }

    const headerStyle = {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      minWidth: 0,
      minHeight: '20px',
      color: 'var(--dsw-alias-label-tertiary)',
      fontSize: 'var(--dsh-content-font-size-secondary, 13px)',
      lineHeight: '20px',
    }

    const titleStyle = {
      flex: '0 1 auto',
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }

    const chipStyle = {
      flex: 'none',
      padding: '0 6px',
      border: '0.5px solid var(--dsw-alias-border-l1)',
      borderRadius: '999px',
      fontSize: '11px',
      lineHeight: '16px',
      color: 'var(--dsw-alias-label-caption, var(--dsw-alias-label-tertiary))',
    }

    const actionStyle = {
      flex: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      padding: '2px 6px',
      border: '0.5px solid var(--dsw-alias-border-l1)',
      borderRadius: 'var(--dsw-radius-sm)',
      background: 'transparent',
      color: 'var(--dsw-alias-label-tertiary)',
      font: 'inherit',
      fontSize: '11px',
      lineHeight: '16px',
      cursor: 'pointer',
    }

    const noteStyle = {
      color: 'var(--dsw-alias-label-tertiary)',
      fontSize: 'var(--dsh-content-font-size-secondary, 13px)',
      lineHeight: '20px',
    }

    const errorTextStyle = {
      margin: 0,
      color: 'var(--dsw-alias-state-error-primary)',
      font: 'var(--dsw-font-markdown-code-block-small, 12px/18px monospace)',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
    }

    /** The chunk is shared by every card; a rejection clears the cache so a retry can succeed. */
    let pelePromise
    function loadPele() {
      pelePromise ??= Promise.resolve()
        .then(() => require.async('./client.pele.js'))
        .catch((error) => {
          pelePromise = undefined
          throw error
        })
      return pelePromise
    }

    /** Parse tool-call arguments, tolerating the streaming partial JSON. */
    function parseArgs(raw) {
      if (typeof raw !== 'string' || raw === '') return undefined
      try {
        const value = JSON.parse(raw)
        return typeof value === 'object' && value !== null ? value : undefined
      } catch {
        return undefined
      }
    }

    /** Flatten settled tool content into display text. */
    function resultText(block) {
      if (!('kind' in block)) return ''
      const parts = []
      for (const item of block.content ?? []) {
        if (item.type === 'text') parts.push(item.text)
        else parts.push(JSON.stringify(item, null, 2))
      }
      return parts.join('\n')
    }

    /** A 14px diagram glyph: two nodes and a link, drawn with currentColor. */
    function DiagramIcon() {
      return h('svg', {
        width: 14, height: 14, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true,
        style: { flex: 'none', display: 'block' },
      },
      h('rect', { x: 1.25, y: 2.25, width: 5, height: 4, rx: 1.25, stroke: 'currentColor', strokeWidth: 1.2 }),
      h('rect', { x: 9.75, y: 9.75, width: 5, height: 4, rx: 1.25, stroke: 'currentColor', strokeWidth: 1.2 }),
      h('path', { d: 'M6.25 4.25h2.5a1 1 0 0 1 1 1v6.75', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }))
    }

    /** A 12px copy glyph. */
    function CopyIcon() {
      return h('svg', {
        width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, style: { display: 'block' },
      },
      h('rect', { x: 5.5, y: 5.5, width: 8, height: 8, rx: 1.5, stroke: 'currentColor', strokeWidth: 1.2 }),
      h('path', { d: 'M10.5 5.5V3.9a1.4 1.4 0 0 0-1.4-1.4H3.9a1.4 1.4 0 0 0-1.4 1.4v5.2a1.4 1.4 0 0 0 1.4 1.4H5.5', stroke: 'currentColor', strokeWidth: 1.2, strokeLinecap: 'round' }))
    }

    /** A 12px check glyph for the copied state. */
    function CheckIcon() {
      return h('svg', {
        width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, style: { display: 'block' },
      }, h('path', { d: 'M3 8.5 6.2 11.7 13 5', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    }

    /** A 12px expand glyph for the fullscreen action. */
    function ExpandIcon() {
      return h('svg', {
        width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, style: { display: 'block' },
      },
      h('path', { d: 'M6 2H2v4M10 2h4v4M6 14H2v-4M10 14h4v-4', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round', strokeLinejoin: 'round' }))
    }

    /** A 12px close glyph for the fullscreen close action. */
    function CloseIcon() {
      return h('svg', {
        width: 12, height: 12, viewBox: '0 0 16 16', fill: 'none', 'aria-hidden': true, style: { display: 'block' },
      }, h('path', { d: 'M3.5 3.5l9 9m0-9l-9 9', stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' }))
    }

    /**
     * Which diagram, if any, the frame-level overlay is showing.
     *
     * The overlay is a separate `shell.overlay` entry, so the card and the overlay
     * share this one piece of state instead of nesting a fixed layer inside the
     * transcript, where clipping and stacking would decide whether it is visible.
     */
    const fullscreen = {
      view: null,
      listeners: new Set(),
      subscribe(listener) {
        fullscreen.listeners.add(listener)
        return () => { fullscreen.listeners.delete(listener) }
      },
      open(view) {
        fullscreen.view = view
        for (const listener of fullscreen.listeners) listener()
      },
      close() {
        if (fullscreen.view === null) return
        fullscreen.view = null
        for (const listener of fullscreen.listeners) listener()
      },
    }

    /**
     * Pele already owns zoom: `always` keeps its in/out/reset knobs mounted on the
     * diagram, and the pan, pinch, wheel and keyboard gestures come with it.
     * @param t - the plugin's translator.
     * @returns mount options shared by the inline card and the fullscreen view.
     */
    function zoomOptions(t) {
      return {
        always: true,
        maxScale: 4,
        labels: { zoomIn: t('zoom.in'), zoomOut: t('zoom.out'), reset: t('zoom.reset') },
      }
    }

    /** Copy action for the diagram source, with a short-lived confirmation. */
    function CopyButton({ source, t }) {
      const [copied, setCopied] = React.useState(false)
      const timer = React.useRef(undefined)
      React.useEffect(() => () => { if (timer.current !== undefined) clearTimeout(timer.current) }, [])
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
        className: 'dsh-mermaid-actions',
        style: actionStyle,
        title: t('card.copy'),
        'aria-label': t('card.copy'),
        onClick: copy,
      }, copied ? h(CheckIcon) : h(CopyIcon), h('span', null, copied ? t('card.copied') : t('card.copy')))
    }

    /** Mounts one diagram into a stable, width-independent container. */
    function DiagramBody({ pele, source, zoom, fill, fit }) {
      const host = React.useRef(null)
      React.useEffect(() => {
        const element = host.current
        if (element === null || pele === undefined) return undefined
        element.replaceChildren()
        /** Pele reports a failed parse through `onError` rather than by throwing. */
        const show = (error) => {
          element.textContent = error instanceof Error ? error.message : String(error)
          element.dataset.peleError = ''
        }
        let mounted
        try {
          mounted = pele.mount(element, source, {
            links: false,
            images: false,
            zoom,
            onError: show,
          })
          if (mounted.error !== undefined) {
            show(mounted.error)
          } else if (fit === true && mounted.zoom !== undefined) {
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
          if (mounted !== undefined) {
            try {
              mounted.destroy()
            } catch {}
          }
        }
      }, [pele, source, zoom, fit])
      return h('div', {
        ref: host,
        className: fill === true ? 'dsh-mermaid-body dsh-mermaid-body-fill' : 'dsh-mermaid-body',
      })
    }

    /** Load the package-local Pele chunk once per card, keeping a failure visible. */
    function usePeleChunk() {
      const [pele, setPele] = React.useState(undefined)
      const [loadError, setLoadError] = React.useState(undefined)
      React.useEffect(() => {
        let live = true
        loadPele().then(
          (module) => { if (live) setPele(module) },
          (error) => { if (live) setLoadError(error instanceof Error ? error.message : String(error)) },
        )
        return () => { live = false }
      }, [])
      return { pele, loadError }
    }

    /** A small icon action that expands the diagram to the frame overlay. */
    function FullscreenButton({ source, title, t }) {
      return h('button', {
        type: 'button',
        className: 'dsh-mermaid-action',
        style: actionStyle,
        title: t('card.fullscreen'),
        'aria-label': t('card.fullscreen'),
        'data-mermaid-fullscreen': '',
        onClick: () => fullscreen.open({ source, title }),
      }, h(ExpandIcon))
    }

    /** Card chrome shared by every state: title row, optional type chip, actions. */
    function CardShell({ heading, source, t, chip, actions, body }) {
      return h('div', { className: 'dsh-mermaid-card', style: cardStyle, 'data-tool': 'mermaid' },
        h('style', null, CARD_CSS),
        h('div', { style: headerStyle },
          h(DiagramIcon),
          h('span', { style: titleStyle }, heading),
          chip != null ? h('span', { style: chipStyle }, chip) : null,
          h('span', { style: actionGroupStyle },
            actions,
            source !== '' ? h(CopyButton, { source, t }) : null)),
        body)
    }

    /** One drawable diagram: resolves Pele, then mounts the SVG into the card body. */
    function DiagramPanel({ source, title, t }) {
      const { pele, loadError } = usePeleChunk()
      const zoom = React.useMemo(() => zoomOptions(t), [t])
      const chip = pele === undefined ? null : String(pele.detectType(source) ?? 'mermaid')
      let body
      if (loadError !== undefined) {
        body = h('div', { style: { ...noteStyle, color: 'var(--dsw-alias-state-error-primary)' } },
          `${t('card.rendererFailed')} ${loadError}`)
      } else if (pele === undefined) {
        body = h('div', { style: noteStyle, role: 'status' }, t('card.rendererLoading'))
      } else {
        body = h(DiagramBody, { pele, source, zoom })
      }
      return h(CardShell, {
        heading: title || t('card.title'),
        source,
        t,
        chip,
        actions: h(FullscreenButton, { source, title, t }),
        body,
      })
    }

    /** The fullscreen body: the same diagram, fitted to the frame overlay. */
    function FullscreenDiagram({ source, t }) {
      const { pele, loadError } = usePeleChunk()
      const zoom = React.useMemo(() => zoomOptions(t), [t])
      if (loadError !== undefined) {
        return h('div', { style: noteStyle }, `${t('card.rendererFailed')} ${loadError}`)
      }
      if (pele === undefined) {
        return h('div', { style: noteStyle, role: 'status' }, t('card.rendererLoading'))
      }
      return h(DiagramBody, { pele, source, zoom, fill: true, fit: true })
    }

    /**
     * Frame-level fullscreen view for one diagram.
     *
     * `shell.overlay` is the harness seat above every column, so the diagram is not
     * clipped by the transcript's scroll container and does not fight the composer
     * for stacking order.
     */
    function FullscreenOverlay({ t }) {
      const [view, setView] = React.useState(fullscreen.view)
      React.useEffect(() => fullscreen.subscribe(() => setView(fullscreen.view)), [])
      React.useEffect(() => {
        if (view === null) return undefined
        const onKey = (event) => {
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
        }
      }, [view])
      if (view === null) return null
      const heading = view.title || t('card.title')
      return h('div', {
        className: 'dsh-mermaid-overlay',
        style: overlayStyle,
        role: 'dialog',
        'aria-modal': 'true',
        'aria-label': heading,
        onClick: (event) => {
          if (event.target === event.currentTarget) fullscreen.close()
        },
      },
      h('div', { style: overlayPanelStyle },
        h('div', { style: headerStyle },
          h(DiagramIcon),
          h('span', { style: titleStyle }, heading),
          h('span', { style: actionGroupStyle },
            h('button', {
              type: 'button',
              className: 'dsh-mermaid-action',
              style: actionStyle,
              title: t('card.exitFullscreen'),
              'aria-label': t('card.exitFullscreen'),
              'data-mermaid-close': '',
              onClick: () => fullscreen.close(),
            }, h(CloseIcon)))),
        h(FullscreenDiagram, { source: view.source, t })))
    }

    /**
     * Render one `mermaid` tool call as a diagram card.
     *
     * A completed turn folds its process rows, so this card is the live view; the
     * turn tail repeats it after the answer, where it stays visible.
     * @param props - keyed tool view payload plus the plugin locale seat.
     */
    function MermaidCard({ block, t }) {
      const settled = 'kind' in block
      const raw = settled ? block.call?.argsRaw ?? '' : block.argsRaw ?? ''
      const args = parseArgs(raw)
      const source = typeof args?.source === 'string' ? args.source.trim() : ''
      const title = typeof args?.title === 'string' ? args.title.trim() : ''
      const failed = settled && (block.isError === true || block.error !== undefined)

      if (failed) {
        return h(CardShell, {
          heading: t('card.error'),
          source,
          t,
          chip: null,
          body: h('pre', { style: errorTextStyle }, resultText(block) || t('card.error')),
        })
      }
      if (source === '') {
        return h(CardShell, {
          heading: t('card.title'),
          source: '',
          t,
          chip: null,
          body: h('div', { style: noteStyle, role: 'status' }, t('card.preparing')),
        })
      }
      return h(DiagramPanel, { source, title, t })
    }

    /** Definition kind that carries a turn's diagrams to the visible turn tail. */
    const DIAGRAMS_KIND = 'mermaid-diagrams'

    /**
     * Fold one turn's `mermaid` calls into turn-owned data.
     *
     * A completed turn folds its process rows into one collapsed group, so a tool
     * card alone leaves the diagram invisible once the turn ends. The turn tail
     * sits outside that group; this Definition is where its data comes from.
     */
    const diagramsDefinition = {
      kind: DIAGRAMS_KIND,
      match(event) {
        if (event.type === 'turn/start') return { id: String(event.data.turn), role: 'start' }
        if (event.type === 'tool/call') {
          return event.data.name === 'mermaid' ? { id: String(event.data.turn), role: 'update' } : null
        }
        if (event.type === 'tool/result' && event.data.message?.source?.kind === 'tool') {
          return { id: String(event.data.turn), role: 'update' }
        }
        return null
      },
      start(_context, match) {
        return { turn: match.event.data.turn, diagrams: [] }
      },
      update(context, match) {
        const event = match.event
        const state = context.state
        // A window that begins after the Turn start has no State yet; the
        // assembler rebuilds from the complete window and replays this then.
        if (state === undefined) return state
        if (event.type === 'tool/call') {
          const callId = String(event.data.callId)
          if (state.diagrams.some((diagram) => diagram.callId === callId)) return state
          const args = parseArgs(event.data.arguments)
          const source = typeof args?.source === 'string' ? args.source.trim() : ''
          if (source === '') return state
          const title = typeof args?.title === 'string' ? args.title.trim() : ''
          return { ...state, diagrams: [...state.diagrams, { callId, source, title }] }
        }
        if (event.type === 'tool/result' && event.data.message?.isError === true) {
          const callId = String(event.data.message.source?.callId ?? '')
          const kept = state.diagrams.filter((diagram) => diagram.callId !== callId)
          return kept.length === state.diagrams.length ? state : { ...state, diagrams: kept }
        }
        return state
      },
      buildLocationData(context, scope, previous) {
        if (scope !== 'turn' || context.state === undefined) return null
        if (previous?.kind === 'turn'
          && previous.turn === context.state.turn
          && previous.key === DIAGRAMS_KIND
          && previous.value.diagrams === context.state.diagrams) {
          return previous
        }
        return {
          kind: 'turn',
          turn: context.state.turn,
          key: DIAGRAMS_KIND,
          value: { diagrams: context.state.diagrams },
        }
      },
    }

    /** The closing turn's diagrams, rendered where they stay visible. */
    function DiagramTail({ turn, t }) {
      const diagrams = turn?.data?.get(DIAGRAMS_KIND)?.diagrams
      if (!Array.isArray(diagrams) || diagrams.length === 0) return null
      return h(React.Fragment, null, diagrams.map((diagram) => h(DiagramPanel, {
        key: diagram.callId,
        source: diagram.source,
        title: diagram.title,
        t,
      })))
    }

    const inject = ['slots', 'locale', 'uiConversation']

    /** Register dictionaries, the turn-data Definition, and both diagram views. */
    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'mermaid-pele: dictionaries')
      ctx.effect(() => ctx.uiConversation.events.register(diagramsDefinition), 'mermaid-pele: turn diagrams')
      ctx.slots.inject('tool.call.toolview', () => ctx.slots.register({
        name: 'tool.call.toolview',
        key: 'mermaid',
        locale: NS,
      }, MermaidCard))
      ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register({
        name: 'conversation.chat.turnTail',
        id: 'mermaid-pele',
        locale: NS,
      }, DiagramTail))
      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'mermaid-pele',
        order: 100,
        locale: NS,
      }, FullscreenOverlay))
    }

    return { inject, apply }
  },
})
