import type * as ReactTypes from 'react'
import type { ClientContext, ClientFace, ModuleRequire } from './types.ts'
import { isRecord } from './json.ts'
import { createRenderer } from './renderer.ts'
import { createUi } from './ui.ts'
import { en, NS, zh } from './i18n.ts'
import { installStyles } from './styles.ts'
import { diagramsDefinition, TOOL_NAME } from './dataset.ts'

/** Package name: the module-loader id, the chunk owner, and the slot entry id. */
export const PLUGIN_ID = '@phatg/dsh-pele'

/** Services this plugin needs before it can register anything. */
const INJECT = ['slots', 'locale', 'uiConversation'] as const

/** True when the module loader handed us the React surface these views call. */
function isReactModule(value: unknown): value is typeof ReactTypes {
  if (!isRecord(value)) return false
  return typeof value.createElement === 'function'
    && typeof value.useState === 'function'
    && typeof value.useEffect === 'function'
    && typeof value.useSyncExternalStore === 'function'
}

/**
 * Build the plugin for one factory call.
 * @param require - the module loader's `require`.
 * @returns the face the loader activates: required services and registrations.
 */
export function createPlugin(require: ModuleRequire): ClientFace {
  const React = require('react')
  if (!isReactModule(React)) {
    throw new Error('mermaid: the module loader did not provide the React runtime.')
  }

  const renderer = createRenderer(require)
  const ui = createUi(React, renderer)

  return {
    inject: [...INJECT],
    apply(ctx: ClientContext): void {
      ctx.effect(() => installStyles(document), 'mermaid-pele: stylesheet')
      ctx.effect(() => ctx.locale.register(NS, { en, zh }), 'mermaid-pele: dictionaries')
      ctx.effect(() => ctx.uiConversation.events.register(diagramsDefinition), 'mermaid-pele: turn diagrams')

      // The live view while the turn runs.
      ctx.slots.inject('tool.call.toolview', () => ctx.slots.register(
        { name: 'tool.call.toolview', key: TOOL_NAME, locale: NS },
        ui.MermaidCard,
      ))
      // The same diagrams again after the turn folds its process rows.
      ctx.slots.inject('conversation.chat.turnTail', () => ctx.slots.register(
        { name: 'conversation.chat.turnTail', id: PLUGIN_ID, locale: NS },
        ui.DiagramTail,
      ))
      // Fullscreen belongs to the frame, above every column.
      ctx.slots.inject('shell.overlay', () => ctx.slots.register(
        { name: 'shell.overlay', id: PLUGIN_ID, order: 100, locale: NS },
        ui.FullscreenOverlay,
      ))
    },
  }
}
