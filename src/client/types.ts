/**
 * The browser-side contract this plugin codes against.
 *
 * These are structural types for the surfaces the module loader and the slot
 * runtime hand to a dynamic package. They are deliberately narrow: the plugin
 * only claims what it actually uses, so a harness change that keeps these
 * shapes working cannot break the plugin quietly through a wider type.
 */
import type { ReactElement } from 'react'

/** Translator the slot runtime binds to the plugin's locale namespace. */
export type Translate = (key: string) => string

/** A component as the slot runtime renders it: props in, element or nothing out. */
export type Component<Props> = (props: Props) => ReactElement | null

/** The `require` the client module loader gives a package factory. */
export interface ModuleRequire {
  (specifier: string): unknown
  async(specifier: string): Promise<unknown>
}

/** One `__ModuleLoader__.load` call: the entry bundle or a package-local chunk. */
export interface ClientRegistration {
  readonly id: string
  readonly chunk?: string
  readonly factory: (require: ModuleRequire) => unknown
}

/** What a plugin factory returns: its required services and its registrations. */
export interface ClientFace {
  readonly inject: readonly string[]
  readonly apply: (ctx: ClientContext) => void
}

/** Registration options shared by list, keyed, and chain slots. */
export interface SlotOptions {
  readonly name: string
  readonly key?: string
  readonly id?: string
  readonly order?: number
  readonly locale?: string
}

/** Dictionary table uploaded to the locale service, keyed by BCP 47 tag. */
export type Dictionaries = Readonly<Record<string, Readonly<Record<string, string>> | undefined>>

/** The services this plugin consumes from its client context. */
export interface ClientContext {
  effect(callback: () => (() => void) | void, label?: string): () => void
  readonly locale: {
    register(namespace: string, dictionaries: Dictionaries): () => void
  }
  readonly uiConversation: {
    readonly events: {
      register<State>(definition: ConversationDefinition<State>): () => void
    }
  }
  readonly slots: {
    inject(slot: string, callback: () => unknown): () => void
    register<Props>(options: SlotOptions, component: Component<Props>): unknown
  }
}

/** One session-log event as a Conversation Definition sees it. */
export interface ConversationEvent {
  readonly type: string
  readonly seq: number
  readonly data: unknown
}

/** A claimed event: which conversation context it belongs to, and why. */
export interface DefinitionMatch {
  readonly id: string
  readonly role: 'start' | 'update'
}

/** Definition-owned state for one conversation context, as the assembler holds it. */
export interface DefinitionContext<State> {
  readonly state: State
}

/** The normalized event a Definition receives alongside its match. */
export interface DefinitionEvent {
  readonly event: ConversationEvent
}

/** A published turn-scoped value, keyed by the Definition's own kind. */
export interface PublishedTurnData<Value> {
  readonly kind: 'turn'
  readonly turn: number
  readonly key: string
  readonly value: Value
}

/**
 * A Conversation Definition.
 *
 * `start` creates the state for one context, `update` folds every later claimed
 * event into it, and `buildLocationData` publishes the value the Chat target
 * exposes to its views. The assembler validates that the published `key` equals
 * the Definition's `kind`.
 */
export interface ConversationDefinition<State> {
  readonly kind: string
  match(event: ConversationEvent): DefinitionMatch | null
  start(context: DefinitionContext<State>, match: DefinitionEvent): State
  update(context: DefinitionContext<State>, match: DefinitionEvent): State
  buildLocationData(
    context: DefinitionContext<State>,
    scope: 'turn' | 'step',
    previous: PublishedTurnData<unknown> | undefined,
  ): PublishedTurnData<unknown> | null
}

/** Tool-call data as the durable session log records it. */
export interface ToolCallData {
  readonly turn: number
  readonly callId: string
  readonly name: string
  readonly arguments: string
}

declare global {
  interface Window {
    __ModuleLoader__?: { load(registration: ClientRegistration): void }
  }
}

/** Content block of a settled tool result. */
export interface ContentBlock {
  readonly type?: string
  readonly text?: string
}

/** The recorded call inside a settled tool block. */
export interface ToolCallHead {
  readonly callId: string
  readonly name: string
  readonly argsRaw?: string
}

/** A tool call before its result settles; arguments are still partial JSON. */
export interface ToolBlockStreaming {
  readonly phase?: 'preparing' | 'start'
  readonly callId?: string
  readonly name?: string
  readonly argsRaw?: string
}

/** A settled tool call, as the keyed `tool.call.toolview` slot receives it. */
export interface ToolBlockSettled {
  readonly kind: string
  readonly callId: string
  readonly call?: ToolCallHead
  readonly content?: readonly ContentBlock[]
  readonly isError?: boolean
  readonly error?: unknown
}

/** One tool row's block: streaming before the call settles, settled after. */
export type ToolBlock = ToolBlockSettled | ToolBlockStreaming
