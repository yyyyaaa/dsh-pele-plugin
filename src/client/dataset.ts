/**
 * The turn model behind the diagrams.
 *
 * A completed turn folds its process rows, so the tool card alone leaves a
 * diagram invisible. This Definition folds each turn's `mermaid` calls into
 * turn-owned data that the turn tail renders where it stays visible.
 */
import type {
  ConversationDefinition,
  ConversationEvent,
  ToolCallData,
} from './types.ts'
import { isRecord, parseArguments } from './json.ts'

/** Definition kind; the assembler requires published data to use it as its key. */
const DIAGRAMS_KIND = 'mermaid-diagrams'

/** Wire name of the tool this plugin owns. */
export const TOOL_NAME = 'mermaid'

/** One rendered diagram in a turn, in call order. */
export interface Diagram {
  readonly callId: string
  readonly source: string
  readonly title: string
}

/** Definition state: the turn it belongs to and the diagrams it collected. */
export interface DiagramsState {
  readonly turn: number
  readonly diagrams: readonly Diagram[]
}

/** The turn object the tail slot renders with. */
export interface TurnLike {
  readonly data?: { get(key: string): unknown }
}

/** A `turn/start` event's data. */
function turnStart(event: ConversationEvent): { turn: number } | null {
  if (event.type !== 'turn/start' || !isRecord(event.data)) return null
  const turn = event.data.turn
  return typeof turn === 'number' ? { turn } : null
}

/** A `mermaid` tool call, narrowed from the log's tool-call shape. */
function mermaidCall(event: ConversationEvent): ToolCallData | null {
  if (event.type !== 'tool/call' || !isRecord(event.data)) return null
  const { turn, callId, name, arguments: raw } = event.data
  if (typeof turn !== 'number' || typeof callId !== 'string' || name !== TOOL_NAME) return null
  if (typeof raw !== 'string') return null
  return { turn, callId, name, arguments: raw }
}

/**
 * Read one call's diagram, or nothing when the arguments are not a diagram yet.
 * @param event - a session event, tested for the `mermaid` call shape.
 * @returns the diagram to publish, or null.
 */
function diagramOf(event: ConversationEvent): Diagram | null {
  const call = mermaidCall(event)
  if (call === null) return null
  const args = parseArguments(call.arguments)
  const source = typeof args.source === 'string' ? args.source.trim() : ''
  if (source === '') return null
  const title = typeof args.title === 'string' ? args.title.trim() : ''
  return { callId: call.callId, source, title }
}

/**
 * True when a previously published value still holds the same diagrams.
 *
 * Compared by value, not by array identity: the assembler may hand back a
 * structurally equal value rebuilt from a replay window.
 */
function sameDiagrams(value: unknown, diagrams: readonly Diagram[]): boolean {
  if (!isRecord(value) || !Array.isArray(value.diagrams)) return false
  const list: unknown[] = value.diagrams
  if (list.length !== diagrams.length) return false
  return diagrams.every((diagram, index) => {
    const published = list[index]
    return isRecord(published)
      && published.callId === diagram.callId
      && published.source === diagram.source
      && published.title === diagram.title
  })
}

/** The diagrams a completed turn published, validated at the boundary. */
export function diagramsOf(turn: TurnLike | undefined): readonly Diagram[] {
  const data = turn?.data
  if (data === undefined || typeof data.get !== 'function') return []
  const published = data.get(DIAGRAMS_KIND)
  if (!isRecord(published) || !Array.isArray(published.diagrams)) return []
  return published.diagrams.filter(isDiagram)
}

/** Reject anything the tail cannot render rather than casting it. */
function isDiagram(value: unknown): value is Diagram {
  if (!isRecord(value)) return false
  return typeof value.callId === 'string'
    && typeof value.source === 'string'
    && typeof value.title === 'string'
}

/**
 * Turn-data Definition for `mermaid` calls.
 *
 * `update` may run before the turn start is loaded, in which case there is no
 * state to fold into; the assembler replays from the complete window later.
 */
export const diagramsDefinition: ConversationDefinition<DiagramsState | undefined> = {
  kind: DIAGRAMS_KIND,

  match(event) {
    const start = turnStart(event)
    if (start !== null) return { id: String(start.turn), role: 'start' }
    const call = mermaidCall(event)
    if (call !== null) return { id: String(call.turn), role: 'update' }
    return null
  },

  start(_context, match) {
    // The matcher only starts on `turn/start`, but a replay window may hand this
    // a different event; an empty fold is safer than an exception inside the
    // conversation assembler.
    const start = turnStart(match.event)
    return { turn: start?.turn ?? 0, diagrams: [] }
  },

  update(context, match) {
    const state = context.state
    if (state === undefined) return undefined

    const diagram = diagramOf(match.event)
    if (diagram !== null) {
      if (state.diagrams.some((candidate) => candidate.callId === diagram.callId)) return state
      return { ...state, diagrams: [...state.diagrams, diagram] }
    }

    return state
  },

  buildLocationData(context, scope, previous) {
    const state = context.state
    if (scope !== 'turn' || state === undefined) return null
    // No diagrams means no contribution: publishing an empty fold for every turn
    // would put this plugin in the assembler's turn index for turns it never
    // touched.
    if (state.diagrams.length === 0) return null
    if (previous !== undefined
      && previous.kind === 'turn'
      && previous.turn === state.turn
      && previous.key === DIAGRAMS_KIND
      && sameDiagrams(previous.value, state.diagrams)) {
      return previous
    }
    return {
      kind: 'turn',
      turn: state.turn,
      key: DIAGRAMS_KIND,
      value: { diagrams: state.diagrams },
    }
  },
}
