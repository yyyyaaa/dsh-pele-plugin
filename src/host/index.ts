/**
 * Host half of `@phatg/dsh-pele`.
 *
 * The model calls `mermaid` with Mermaid source. This half validates that source
 * with Pele before anything reaches the browser, so a broken diagram comes back
 * as a fixable tool error naming the line and column instead of an empty card.
 * The Client half renders the same source as SVG in the chat.
 */
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { RenderOptions } from 'pele'

/** Wire name of the tool and the `tool.call.toolview` key the Client registers. */
const TOOL_NAME = 'mermaid'

/** The value the tool returns; the model sees rendered text, not this shape. */
export interface DiagramValue {
  readonly type: string
  readonly mermaidType: string
  readonly width: number
  readonly height: number
}

/** Host services this plugin touches, narrowed to the calls it makes. */
export interface HostContext {
  readonly tools: { register(definition: unknown): () => void }
  effect(callback: () => (() => void) | void, label?: string): () => void
  get(name: string): unknown
}

/** Prompt registry face used to add standing guidance. */
interface PromptRegistry {
  section(section: { name: string; order: number; text: string }): () => void
}

/**
 * Standing guidance, registered before the environment suffix.
 *
 * A tool description reaches the model beside its schema only; a model that
 * decides to draw prose-first writes a fenced block the Client never sees, so
 * this states the preference in the prompt itself.
 */
const PROMPT_SECTION = {
  name: 'mermaid-diagrams',
  order: 9000,
  text:
    'Diagrams: call the `mermaid` tool with the complete Mermaid source instead of writing a '
    + '```mermaid fenced code block; the tool draws a themed SVG card in the conversation, and a '
    + 'failed render names the line to fix. If that tool is unavailable, fall back to a fenced code '
    + 'block. Keep the explanation in the reply text rather than repeating the source.',
}

/** The Host only needs a successful parse and layout; the Client owns the visible SVG. */
const RENDER_OPTIONS: RenderOptions = { responsive: false, links: false, images: false }

/** Loaded once per Host process: Pele is pure and synchronous. */
let pelePromise: Promise<typeof import('pele')> | undefined

/**
 * Import Pele on first use, so plugin activation stays cheap and a missing
 * dependency fails at the call, with a message that names the fix.
 */
function loadPele(): Promise<typeof import('pele')> {
  pelePromise ??= import('pele').catch((error: unknown) => {
    pelePromise = undefined
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`mermaid: the "pele" package could not be loaded (${message})`, { cause: error })
  })
  return pelePromise
}

/** True when a value exposes the one prompt method this plugin calls. */
function isPromptRegistry(value: unknown): value is PromptRegistry {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { section?: unknown }).section === 'function'
}

/**
 * Turn a failure into a message that names what to change.
 * @param pele - the loaded Pele module, which owns the error class.
 * @param error - the thrown value.
 * @returns the model-facing message.
 */
function describeError(pele: typeof import('pele'), error: unknown): string {
  if (!(error instanceof pele.PeleError)) {
    return error instanceof Error ? error.message : String(error)
  }
  const at = error.line > 0 ? ` at line ${error.line}, column ${error.column}` : ''
  return `mermaid could not render this ${error.type ?? 'diagram'} (${error.code}${at}): ${error.message}`
}

/** The tool definition, built once per Host process. */
const TOOL = defineTool({
  name: TOOL_NAME,
  description: 'Render a Mermaid diagram as an SVG card in the chat. Use it for every diagram the user should see: flowchart, sequence, state, class, ER, gantt, pie, mindmap, timeline, kanban, git graph, block, radar, treemap, sankey, quadrant, xychart, packet, or C4. Pass complete Mermaid source without the surrounding fence. The card appears for the user; the tool result reports only the diagram type and size, so keep the explanation in your message and do not repeat the source as a fenced block. A failed render names the line and column, so correct the source and call again.',
  parameters: {
    source: {
      type: 'string',
      required: true,
      description: 'Complete Mermaid source, e.g. "flowchart LR\\n  A[Input] --> B[Output]". Do not include a ```mermaid fence.',
    },
    title: {
      type: 'string',
      description: 'Optional short title rendered above the diagram, e.g. "Request lifecycle".',
    },
  },
  output: {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        type: { type: 'string', required: true },
        mermaidType: { type: 'string', required: true },
        width: { type: 'number', required: true },
        height: { type: 'number', required: true },
      },
    },
    render: (_args: unknown, value: DiagramValue) => [{
      type: 'text',
      text: `Rendered a ${value.mermaidType} diagram (${value.width}×${value.height}px) and showed it to the user as an SVG card.`,
    }],
  },
  async execute(args: { source: string; title?: string }): Promise<DiagramValue> {
    const source = args.source.trim()
    if (source.length === 0) throw new Error('mermaid: `source` is empty; pass the Mermaid source for the diagram.')
    const pele = await loadPele()
    try {
      const result = pele.render(source, RENDER_OPTIONS)
      return {
        type: String(result.type),
        mermaidType: String(result.mermaidType),
        width: Math.round(result.width * 100) / 100,
        height: Math.round(result.height * 100) / 100,
      }
    } catch (error) {
      throw new Error(describeError(pele, error), { cause: error })
    }
  },
})

/** Declares the services this plugin requires from its Host context. */
export const inject = ['tools']

/**
 * Register the `mermaid` tool and its standing prompt guidance.
 * @param ctx - registrant context carrying the tool registry.
 */
export function apply(ctx: HostContext): void {
  ctx.tools.register(TOOL)

  // The prompt registry is optional: a composition without it keeps the tool.
  if (typeof ctx.get !== 'function') return
  const prompt = ctx.get('systemPrompt')
  if (!isPromptRegistry(prompt)) return
  ctx.effect(() => prompt.section(PROMPT_SECTION), 'mermaid-pele: diagram guidance')
}
