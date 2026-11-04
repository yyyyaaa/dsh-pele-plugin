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
  ToolResultData,
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

/** A settled tool result, narrowed to the fields that identify its call. */
function toolResult(event: ConversationEvent): ToolResultData | null {
  if (event.type !== 'tool/result' || !isRecord(event.data)) return null
  const { turn, message } = event.data
  if (typeof turn !== 'number' || !isRecord(message) || !isRecord(message.source)) return null
  const source = message.source
  if (source.kind !== 'tool' || typeof source.callId !== 'string') return null
  return { turn, callId: source.callId, failed: message.isError === true }
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

/** True when a previously published value still holds the same diagram array. */
function sameDiagrams(value: unknown, diagrams: readonly Diagram[]): boolean {
  return isRecord(value) && value.diagrams === diagrams
}

/** The diagrams a completed turn published, validated at the boundary. */
export function diagramsOf(turn: TurnLike | undefined): readonly Diagram[] {
  const published = turn?.data?.get(DIAGRAMS_KIND)
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
    const result = toolResult(event)
    if (result !== null) return { id: String(result.turn), role: 'update' }
    return null
  },

  start(_context, match) {
    const start = turnStart(match.event)
    if (start === null) throw new Error('mermaid-diagrams: start requires a turn/start event')
    return { turn: start.turn, diagrams: [] }
  },

  update(context, match) {
    const state = context.state
    if (state === undefined) return undefined

    const diagram = diagramOf(match.event)
    if (diagram !== null) {
      if (state.diagrams.some((candidate) => candidate.callId === diagram.callId)) return state
      return { ...state, diagrams: [...state.diagrams, diagram] }
    }

    const result = toolResult(match.event)
    if (result === null || !result.failed) return state
    const diagrams = state.diagrams.filter((candidate) => candidate.callId !== result.callId)
    return diagrams.length === state.diagrams.length ? state : { ...state, diagrams }
  },

  buildLocationData(context, scope, previous) {
    const state = context.state
    if (scope !== 'turn' || state === undefined) return null
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
