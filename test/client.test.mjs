/**
 * Real-artifact check: the shipped `client.js` plus its package-local Pele chunk,
 * rendered with real React and real Pele in jsdom.
 *
 * The module loader is a faithful stand-in for `window.__ModuleLoader__`: it
 * collects the entry registration and the chunk registration, and `require.async`
 * resolves the sibling chunk exactly as dsh-client-modules does. Nothing about
 * Pele is stubbed, so a mount that cannot draw a diagram fails here.
 */
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})
globalThis.window = dom.window
globalThis.document = dom.window.document
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
globalThis.Node = dom.window.Node
globalThis.HTMLElement = dom.window.HTMLElement
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ResizeObserver
dom.window.ResizeObserver = ResizeObserver

const React = require('react')
const { createRoot } = require('react-dom/client')
const { act } = require('react-dom/test-utils')

/** Module table the bundle's registrations land in. */
const table = new Map()
dom.window.__ModuleLoader__ = {
  load(registration) {
    const id = registration.chunk === undefined ? registration.id : `${registration.id}/${registration.chunk}`
    table.set(id, registration)
  },
}

await import('../client.js')

const entry = table.get('@local/mermaid-pele')
assert.ok(entry !== undefined, 'the entry bundle registers under its package name')
assert.equal(entry.chunk, undefined, 'the entry is not itself a chunk')

const requireFromBundle = (specifier) => {
  if (specifier === 'react') return React
  throw new Error(`unexpected require(${JSON.stringify(specifier)})`)
}
requireFromBundle.async = async (specifier) => {
  assert.equal(specifier, './client.pele.js', 'Pele arrives through the package-local chunk')
  // The real loader fetches the chunk URL and executes it; executing it is what
  // registers the chunk with __ModuleLoader__.
  await import('../client.pele.js')
  const chunk = table.get('@local/mermaid-pele/client.pele.js')
  assert.ok(chunk !== undefined, 'the chunk registers itself through __ModuleLoader__')
  return chunk.factory()
}

const client = entry.factory(requireFromBundle)
assert.deepEqual(client.inject, ['slots', 'locale', 'uiConversation'])

let toolSlot
let tailSlot
let overlaySlot
let dictionary
let definition
const ctx = {
  effect: (fn) => fn(),
  locale: { register: (name, value) => { dictionary = { name, value }; return () => {} } },
  uiConversation: { events: { register: (value) => { definition = value; return () => {} } } },
  slots: {
    inject: (name, callback) => {
      const registration = callback()
      if (name === 'tool.call.toolview') toolSlot = registration
      else if (name === 'conversation.chat.turnTail') tailSlot = registration
      else if (name === 'shell.overlay') overlaySlot = registration
      else throw new Error(`unexpected slot ${JSON.stringify(name)}`)
      return () => {}
    },
    register: (options, Component) => ({ options, Component }),
  },
}

act(() => { client.apply(ctx) })
assert.equal(toolSlot.options.key, 'mermaid', 'renders the wire tool name `mermaid`')
assert.equal(toolSlot.options.locale, 'mermaid-pele', 'binds the plugin namespace for `t`')
assert.equal(tailSlot.options.id, 'mermaid-pele', 'contributes one turn-tail entry')
assert.equal(tailSlot.options.locale, 'mermaid-pele')
assert.equal(overlaySlot.options.id, 'mermaid-pele', 'contributes the frame-level fullscreen overlay')
assert.equal(overlaySlot.options.locale, 'mermaid-pele')
assert.equal(definition.kind, 'mermaid-diagrams', 'registers the turn-data Definition')

// The locale service looks keys up verbatim in a flat dictionary; a nested
// object would make every label render as its own key.
for (const locale of ['en', 'zh']) {
  const dict = dictionary.value[locale]
  assert.ok(dict !== undefined, `registers ${locale}`)
  const nested = Object.keys(dict).filter((key) => !key.includes('.')).slice()
  assert.deepEqual(nested, [], `${locale} uses flat dotted keys`)
}
assert.equal(dictionary.value.en['card.title'], 'Mermaid diagram')

/** The real service's lookup: exact key in the active dictionary, else the key. */
const t = (key) => dictionary.value.en[key] ?? key

/** Visible text under the root, ignoring component-local <style> elements. */
function visibleText() {
  const clone = document.getElementById('root').cloneNode(true)
  for (const style of clone.querySelectorAll('style')) style.remove()
  return clone.textContent ?? ''
}

const SOURCE = 'flowchart LR\n  A[Input] --> B[Output]'
const root = createRoot(document.getElementById('root'))

/** Render and let the chunk promise and the mount effect settle. */
async function render(element) {
  await act(async () => { root.render(element) })
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)) })
}

// --- the live tool view -----------------------------------------------------

const Card = toolSlot.Component
const settled = (args, extra = {}) => ({
  callId: 'c1',
  toolName: 'mermaid',
  phase: 'result',
  t,
  block: {
    kind: 'tool-call',
    callId: 'c1',
    call: { callId: 'c1', name: 'mermaid', argsRaw: JSON.stringify(args) },
    content: [{ type: 'text', text: 'Rendered a flowchart-v2 diagram' }],
    subCalls: [],
    isError: false,
    ...extra,
  },
})

await render(React.createElement(Card, {
  callId: 'p1',
  phase: 'preparing',
  t,
  block: { callId: 'p1', name: 'mermaid', phase: 'preparing', argsRaw: '{"sour' },
}))
assert.match(visibleText(), /Preparing diagram/, 'preparing state is localized, not a raw key')
assert.doesNotMatch(visibleText(), /card\.preparing/, 'no dictionary key leaks into the UI')

await render(React.createElement(Card, settled({ source: SOURCE }, {
  isError: true,
  content: [{ type: 'text', text: 'mermaid could not render this flowchart (syntax at line 2, column 3): boom' }],
})))
assert.match(visibleText(), /Diagram failed/, 'failure state is localized')
assert.match(visibleText(), /syntax at line 2, column 3/, 'the tool error text survives')

await render(React.createElement(Card, settled({ source: SOURCE, title: 'Request flow' })))
assert.match(visibleText(), /Request flow/, 'the title labels the card')
assert.match(visibleText(), /flowchart/, 'the type chip names the diagram')
assert.doesNotMatch(visibleText(), /card\.(title|copy)/, 'no raw keys in the settled card')

const liveSvg = document.querySelector('.dsh-mermaid-body svg')
assert.ok(liveSvg !== null, 'Pele renders an SVG into the tool card')
assert.ok(liveSvg.classList.contains('pele'), 'the SVG is a Pele diagram')
assert.ok(liveSvg.querySelectorAll('*').length > 0, 'the diagram has drawn content')
assert.ok(Number(liveSvg.getAttribute('width')) > 0, 'the diagram carries a laid-out width')

// --- the turn tail, which stays visible after the process rows fold ----------

const context = { state: undefined }
context.state = definition.start(context, { event: { type: 'turn/start', data: { turn: 4 }, seq: 10 } })
assert.deepEqual(context.state.diagrams, [], 'a turn starts with no diagrams')

const callEvent = {
  type: 'tool/call',
  seq: 12,
  data: { turn: 4, callId: 'call-1', name: 'mermaid', arguments: JSON.stringify({ source: SOURCE, title: 'Tail diagram' }) },
}
assert.deepEqual(definition.match(callEvent), { id: '4', role: 'update' }, 'claims the mermaid call for its turn')
context.state = definition.update(context, { event: callEvent })
assert.equal(context.state.diagrams.length, 1)
assert.equal(context.state.diagrams[0].source, SOURCE)
assert.equal(context.state.diagrams[0].title, 'Tail diagram')

const otherCall = { event: { type: 'tool/call', seq: 13, data: { turn: 4, callId: 'call-2', name: 'bash', arguments: '{}' } } }
assert.equal(definition.match(otherCall.event), null, 'ignores other tools')

context.state = definition.update(context, {
  event: { type: 'tool/result', seq: 14, data: { turn: 4, message: { isError: true, source: { kind: 'tool', callId: 'call-1' } } } },
})
assert.equal(context.state.diagrams.length, 0, 'a failed call leaves no tail card')

context.state = definition.update(context, { event: callEvent })
const published = definition.buildLocationData({ state: context.state }, 'turn', undefined)
assert.equal(published.kind, 'turn')
assert.equal(published.turn, 4)
assert.equal(published.key, 'mermaid-diagrams', 'publishes under its own kind, as the assembler requires')
assert.equal(definition.buildLocationData({ state: context.state }, 'step', undefined), null, 'publishes turn data only')
assert.equal(
  definition.buildLocationData({ state: context.state }, 'turn', published),
  published,
  'an unchanged value keeps its identity',
)

const Tail = tailSlot.Component
await render(React.createElement(Tail, {
  seq: 30,
  t,
  turn: { data: new Map([['mermaid-diagrams', published.value]]) },
}))
assert.match(visibleText(), /Tail diagram/, 'the tail card shows the title')
const tailSvg = document.querySelector('.dsh-mermaid-body svg')
assert.ok(tailSvg !== null && tailSvg.classList.contains('pele'), 'the tail renders a Pele diagram')

await render(React.createElement(Tail, { seq: 31, t, turn: { data: new Map() } }))
assert.equal(document.querySelector('.dsh-mermaid-card'), null, 'a turn without diagrams renders nothing')

// --- zoom knobs and the fullscreen overlay ----------------------------------

await render(React.createElement(Tail, {
  seq: 32,
  t,
  turn: { data: new Map([['mermaid-diagrams', published.value]]) },
}))
const zoomKnobs = document.querySelectorAll('.pele-zoom button')
assert.equal(zoomKnobs.length, 3, 'Pele renders its own zoom in/out/reset knobs')
assert.equal(zoomKnobs[0].getAttribute('aria-label'), 'Zoom in', 'knobs are localized')
assert.match(zoomKnobs[2].getAttribute('aria-label') ?? '', /Reset/)

const expand = document.querySelector('[data-mermaid-fullscreen]')
assert.ok(expand !== null, 'the card offers a fullscreen action')

await act(async () => {
  expand.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
})

const Overlay = overlaySlot.Component
await render(React.createElement(Overlay, { t }))
const dialog = document.querySelector('[role="dialog"]')
assert.ok(dialog !== null, 'clicking fullscreen opens the frame-level overlay')
assert.ok(dialog.querySelector('svg.pele') !== null, 'the overlay draws the same diagram')
assert.ok(dialog.querySelector('[data-mermaid-close]') !== null, 'the overlay offers a close action')
assert.equal(document.documentElement.style.overflow, 'hidden', 'the page behind the overlay does not scroll')

await act(async () => {
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
})
assert.equal(document.querySelector('[role="dialog"]'), null, 'Escape closes the overlay')
assert.equal(document.documentElement.style.overflow, '', 'the scroll lock is released')

console.log('client: tool card, turn tail, zoom knobs, and fullscreen overlay all work with real Pele')
