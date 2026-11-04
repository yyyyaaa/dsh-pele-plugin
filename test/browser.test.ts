import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { ReactElement } from 'react'
import { PLUGIN_ID } from '../src/client/plugin.ts'
import type { ClientRegistration, ConversationDefinition, ModuleRequire } from '../src/client/types.ts'
import type { DiagramsState } from '../src/client/dataset.ts'
import type { OverlayProps, ToolViewProps, TurnTailProps } from '../src/client/ui.ts'

/** What a slot entry holds once the plugin registers it. */
interface Slot<Props> {
  readonly options: Record<string, unknown>
  readonly Component: (props: Props) => ReactElement | null
}

/** The slice of the client context the plugin touches. */
interface ClientContextStub {
  effect(callback: () => (() => void) | void, label?: string): () => void
  readonly locale: {
    register(namespace: string, dictionaries: Record<string, Record<string, string> | undefined>): () => void
  }
  readonly uiConversation: {
    readonly events: { register<State>(definition: ConversationDefinition<State>): () => void }
  }
  readonly slots: {
    inject(slot: string, callback: () => unknown): () => void
    register<Props>(
      options: Record<string, unknown>,
      component: (props: Props) => ReactElement | null,
    ): Slot<Props>
  }
}

const SOURCE = 'flowchart LR\n  A[Input] --> B[Output]'

/** Module table the bundle's registrations land in. */
const table = new Map<string, ClientRegistration>()
let toolSlot: Slot<ToolViewProps> | undefined
let tailSlot: Slot<TurnTailProps> | undefined
let overlaySlot: Slot<OverlayProps> | undefined
let capturedDefinition: unknown
let dictionaries: Record<string, Record<string, string> | undefined> | undefined

/** Fail loudly instead of asserting non-null in every test. */
function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`${what} is missing`)
  return value
}

/** The locale service's lookup: exact key in the active dictionary, else the key. */
function translate(key: string): string {
  return dictionaries?.en?.[key] ?? key
}

beforeAll(async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

  window.__ModuleLoader__ = {
    load(registration: ClientRegistration): void {
      const id = registration.chunk === undefined
        ? registration.id
        : `${registration.id}/${registration.chunk}`
      table.set(id, registration)
    },
  }

  // Warm the chunk so the first card resolves inside the render's act window
  // instead of during a later assertion.
  await import(/* @vite-ignore */ new URL('../dist/client.pele.js', import.meta.url).href)

  const bundleRequire = ((specifier: string): unknown => {
    if (specifier === 'react') return React
    throw new Error(`unexpected require(${JSON.stringify(specifier)})`)
  }) as ModuleRequire

  bundleRequire.async = async (specifier: string): Promise<unknown> => {
    expect(specifier).toBe('./client.pele.js')
    // The real loader fetches the chunk URL and executes it; executing it is what
    // registers the chunk with __ModuleLoader__.
    await import(/* @vite-ignore */ new URL('../dist/client.pele.js', import.meta.url).href)
    const chunk = required(table.get(`${PLUGIN_ID}/client.pele.js`), 'the Pele chunk registration')
    return chunk.factory(bundleRequire)
  }

  await import(/* @vite-ignore */ new URL('../dist/client.js', import.meta.url).href)
  const entry = required(table.get(PLUGIN_ID), 'the entry registration')
  expect(entry.chunk).toBeUndefined()

  const client = entry.factory(bundleRequire) as {
    inject: readonly string[]
    apply(ctx: ClientContextStub): void
  }

  const ctx: ClientContextStub = {
    effect(callback) {
      callback()
      return () => {}
    },
    locale: {
      register(_namespace, value) {
        dictionaries = value
        return () => {}
      },
    },
    uiConversation: {
      events: {
        register<State>(value: ConversationDefinition<State>) {
          capturedDefinition = value
          return () => {}
        },
      },
    },
    slots: {
      inject(name, callback) {
        const registration = callback()
        if (name === 'tool.call.toolview') toolSlot = registration as Slot<ToolViewProps>
        else if (name === 'conversation.chat.turnTail') tailSlot = registration as Slot<TurnTailProps>
        else if (name === 'shell.overlay') overlaySlot = registration as Slot<OverlayProps>
        else throw new Error(`unexpected slot ${JSON.stringify(name)}`)
        return () => {}
      },
      register(options, component) {
        return { options, Component: component }
      },
    },
  }

  expect(client.inject).toEqual(['slots', 'locale', 'uiConversation'])
  await act(async () => {
    client.apply(ctx)
  })
})

let container: HTMLDivElement
let root: ReturnType<typeof createRoot>

beforeEach(() => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => {
    root.unmount()
  })
  container.remove()
})

/** Render and let the chunk promise and the mount effect settle. */
async function render(element: ReactElement): Promise<void> {
  await act(async () => {
    root.render(element)
  })
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20))
  })
}

/** Text under the render root; the stylesheet lives in the document head. */
function visibleText(): string {
  return container.textContent ?? ''
}

/** Query an element the test needs, failing with the selector when absent. */
function mustQuery<T extends Element>(selector: string): T {
  const element = container.querySelector<T>(selector)
  if (element === null) throw new Error(`no element matching ${JSON.stringify(selector)}`)
  return element
}

/**
 * Wait for an element to appear.
 *
 * The Pele chunk resolves asynchronously, so the first card that needs it shows
 * the loading note for a frame or two; asserting on a fixed delay would make the
 * suite depend on test order.
 */
async function waitForElement<T extends Element>(scope: ParentNode, selector: string): Promise<T> {
  let found: T | undefined
  await vi.waitFor(() => {
    found = scope.querySelector<T>(selector) ?? undefined
    expect(found).toBeDefined()
  }, { timeout: 5000 })
  return required(found, selector)
}

/** The turn-data definition, recorded generically by the stub. */
function definition(): ConversationDefinition<DiagramsState | undefined> {
  return required(capturedDefinition, 'the turn-data definition') as ConversationDefinition<DiagramsState | undefined>
}

/** Props for one settled tool call. */
function settled(args: Record<string, unknown>, extra: Record<string, unknown> = {}): ToolViewProps {
  return {
    t: translate,
    block: {
      kind: 'tool-call',
      callId: 'c1',
      call: { callId: 'c1', name: 'mermaid', argsRaw: JSON.stringify(args) },
      content: [{ type: 'text', text: 'Rendered a flowchart-v2 diagram' }],
      isError: false,
      ...extra,
    },
  }
}

describe('mermaid client plugin', () => {
  it('registers the tool view, turn tail, overlay, definition, and flat dictionaries', () => {
    expect(toolSlot?.options.key).toBe('mermaid')
    expect(toolSlot?.options.locale).toBe('mermaid-pele')
    expect(tailSlot?.options.id).toBe(PLUGIN_ID)
    expect(overlaySlot?.options.id).toBe(PLUGIN_ID)
    expect(definition().kind).toBe('mermaid-diagrams')

    const dicts = required(dictionaries, 'the dictionaries')
    for (const locale of ['en', 'zh']) {
      const dict = required(dicts[locale], `${locale} dictionary`)
      expect(Object.keys(dict).filter((key) => !key.includes('.'))).toEqual([])
    }
    expect(dicts.en?.['card.title']).toBe('Mermaid diagram')
  })

  it('shows a localized preparing state until the arguments parse', async () => {
    await render(React.createElement(required(toolSlot, 'tool view').Component, {
      t: translate,
      block: { phase: 'preparing', argsRaw: '{"sour' },
    }))
    expect(visibleText()).toContain('Preparing diagram')
    expect(visibleText()).not.toContain('card.preparing')
  })

  it('shows the tool error when the call failed', async () => {
    await render(React.createElement(required(toolSlot, 'tool view').Component, settled({ source: SOURCE }, {
      isError: true,
      content: [{ type: 'text', text: 'mermaid could not render this flowchart (syntax at line 2, column 3): boom' }],
    })))
    expect(visibleText()).toContain('Diagram failed')
    expect(visibleText()).toContain('syntax at line 2, column 3')
  })

  it('draws the diagram with Pele and localizes the card', async () => {
    await render(React.createElement(required(toolSlot, 'tool view').Component, settled({ source: SOURCE, title: 'Request flow' })))

    const svg = await waitForElement<SVGElement>(container, '.dsh-mermaid-body svg')
    expect(visibleText()).toContain('Request flow')
    expect(visibleText()).toContain('flowchart')
    expect(visibleText()).not.toMatch(/card\.(title|copy)/)

    expect(svg.classList.contains('pele')).toBe(true)
    expect(svg.querySelectorAll('*').length).toBeGreaterThan(0)
    expect(Number(svg.getAttribute('width'))).toBeGreaterThan(0)
  })

  it('keeps every control in one toolbar', async () => {
    await render(React.createElement(required(toolSlot, 'tool view').Component, settled({ source: SOURCE })))
    await waitForElement(container, '.dsh-mermaid-body svg')

    expect(container.querySelectorAll('.dsh-mermaid-toolbar')).toHaveLength(1)
    expect(container.querySelector('.pele-zoom')).toBeNull()

    const toolbar = mustQuery<HTMLElement>('.dsh-mermaid-toolbar')
    expect(toolbar.querySelectorAll('button')).toHaveLength(5)
    expect(mustQuery('[data-mermaid-zoom="out"]').getAttribute('aria-label')).toBe('Zoom out')
    expect(mustQuery('[data-mermaid-zoom="in"]').getAttribute('aria-label')).toBe('Zoom in')
    expect(mustQuery('[data-mermaid-zoom="reset"]').getAttribute('aria-label')).toBe('Reset zoom')
    expect(container.querySelector('[data-mermaid-fullscreen]')).not.toBeNull()
    expect(container.querySelector('[data-mermaid-copy]')).not.toBeNull()
  })

  it('zooms the diagram from the toolbar', async () => {
    await render(React.createElement(required(toolSlot, 'tool view').Component, settled({ source: SOURCE })))
    const svg = await waitForElement<SVGElement>(container, '.dsh-mermaid-body svg')
    const before = svg.style.width

    await act(async () => {
      mustQuery<HTMLElement>('[data-mermaid-zoom="in"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(svg.style.width).not.toBe(before)

    await act(async () => {
      mustQuery<HTMLElement>('[data-mermaid-zoom="reset"]')
        .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(svg.style.width).toBe(before)
  })

  it('folds mermaid calls into turn data and drops failed ones', () => {
    const fold = definition()
    const callEvent = {
      type: 'tool/call',
      seq: 12,
      data: { turn: 4, callId: 'call-1', name: 'mermaid', arguments: JSON.stringify({ source: SOURCE, title: 'Tail diagram' }) },
    }

    expect(fold.match(callEvent)).toEqual({ id: '4', role: 'update' })
    expect(fold.match({ type: 'tool/call', seq: 13, data: { turn: 4, callId: 'c2', name: 'bash', arguments: '{}' } })).toBeNull()

    let state = fold.start({ state: undefined }, { event: { type: 'turn/start', seq: 10, data: { turn: 4 } } })
    state = fold.update({ state }, { event: callEvent })
    expect(state?.diagrams).toHaveLength(1)
    expect(state?.diagrams[0]?.source).toBe(SOURCE)
    expect(state?.diagrams[0]?.title).toBe('Tail diagram')

    const failed = fold.update({ state }, {
      event: { type: 'tool/result', seq: 14, data: { turn: 4, message: { isError: true, source: { kind: 'tool', callId: 'call-1' } } } },
    })
    expect(failed?.diagrams).toHaveLength(0)

    state = fold.update({ state: failed }, { event: callEvent })
    const published = required(fold.buildLocationData({ state }, 'turn', undefined) ?? undefined, 'published turn data')
    expect(published.key).toBe('mermaid-diagrams')
    expect(published.turn).toBe(4)
    expect(fold.buildLocationData({ state }, 'step', undefined)).toBeNull()
    expect(fold.buildLocationData({ state }, 'turn', published)).toBe(published)
  })

  it('renders the turn tail from published turn data', async () => {
    const fold = definition()
    const callEvent = {
      type: 'tool/call',
      seq: 12,
      data: { turn: 4, callId: 'call-1', name: 'mermaid', arguments: JSON.stringify({ source: SOURCE, title: 'Tail diagram' }) },
    }
    let state = fold.start({ state: undefined }, { event: { type: 'turn/start', seq: 10, data: { turn: 4 } } })
    state = fold.update({ state }, { event: callEvent })
    const published = required(fold.buildLocationData({ state }, 'turn', undefined) ?? undefined, 'published turn data')

    await render(React.createElement(required(tailSlot, 'turn tail').Component, {
      t: translate,
      turn: { data: new Map([['mermaid-diagrams', published.value]]) },
    }))

    expect(visibleText()).toContain('Tail diagram')
    await waitForElement(container, '.dsh-mermaid-body svg')
  })

  it('renders nothing for a turn without diagrams', async () => {
    await render(React.createElement(required(tailSlot, 'turn tail').Component, {
      t: translate,
      turn: { data: new Map() },
    }))
    expect(container.querySelector('.dsh-mermaid-card')).toBeNull()
  })

  it('opens the fullscreen overlay, draws the diagram, and closes on Escape', async () => {
    const fold = definition()
    const callEvent = {
      type: 'tool/call',
      seq: 12,
      data: { turn: 4, callId: 'call-1', name: 'mermaid', arguments: JSON.stringify({ source: SOURCE, title: 'Tail diagram' }) },
    }
    let state = fold.start({ state: undefined }, { event: { type: 'turn/start', seq: 10, data: { turn: 4 } } })
    state = fold.update({ state }, { event: callEvent })
    const published = required(fold.buildLocationData({ state }, 'turn', undefined) ?? undefined, 'published turn data')

    await render(React.createElement(required(tailSlot, 'turn tail').Component, {
      t: translate,
      turn: { data: new Map([['mermaid-diagrams', published.value]]) },
    }))

    const expand = mustQuery<HTMLElement>('[data-mermaid-fullscreen]')
    await act(async () => {
      expand.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await render(React.createElement(required(overlaySlot, 'overlay').Component, { t: translate }))
    const dialog = mustQuery<HTMLElement>('[role="dialog"]')
    await waitForElement(dialog, 'svg.pele')
    expect(dialog.querySelector('[data-mermaid-close]')).not.toBeNull()
    expect(dialog.querySelector('[data-mermaid-zoom="in"]')).not.toBeNull()
    expect(document.documentElement.style.overflow).toBe('hidden')

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.documentElement.style.overflow).toBe('')
  })
})
