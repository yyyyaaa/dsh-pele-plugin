/**
 * Host half of `@local/mermaid-pele`.
 *
 * The model calls `mermaid` with Mermaid source; this half validates that source
 * with Pele before anything reaches the browser, so a broken diagram comes back
 * as a fixable tool error (line and column included) instead of an empty card.
 * The Client half renders the same source to SVG in the chat.
 */
import { defineTool } from '@deepseek-ai/dsh-tools'

/** Wire name of the tool and the `tool.call.toolview` key the Client half registers. */
const TOOL_NAME = 'mermaid'

/** Loaded once per Host process: Pele is pure and synchronous, so one instance is enough. */
let pelePromise

/**
 * Import Pele on first use so plugin activation stays cheap and a missing
 * dependency fails at the call, with a message that names the fix.
 * @returns the Pele module namespace.
 */
function loadPele() {
  pelePromise ??= import('pele').catch((error) => {
    pelePromise = undefined
    throw new Error(`mermaid: the "pele" package could not be loaded (${error instanceof Error ? error.message : String(error)})`)
  })
  return pelePromise
}

/**
 * Render options shared by the Host validation pass. The Host only needs a
 * successful parse and layout; the Client owns the visible SVG.
 */
const RENDER_OPTIONS = { responsive: false, links: false, images: false }

export const inject = ['tools']

/**
 * Standing guidance, registered once per Host composition at an order before the
 * environment suffix. The tool description reaches the model only beside its
 * schema; a model that decides to draw prose-first writes a fenced block the
 * Client never sees, so this section states the preference in the prompt itself.
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

/**
 * Register the `mermaid` tool on the tools registry.
 * @param ctx - registrant context carrying the tool registry.
 */
export function apply(ctx) {
  ctx.tools.register(defineTool({
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
      render: (_args, value) => [{
        type: 'text',
        text: `Rendered a ${value.mermaidType} diagram (${value.width}×${value.height}px) and showed it to the user as an SVG card.`,
      }],
    },
    async execute(args) {
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
        if (error instanceof pele.PeleError) {
          const at = error.line > 0 ? ` at line ${error.line}, column ${error.column}` : ''
          throw new Error(`mermaid could not render this ${error.type ?? 'diagram'} (${error.code}${at}): ${error.message}`)
        }
        throw error
      }
    },
  }))

  // The prompt registry is optional: a composition without it keeps the tool.
  const systemPrompt = typeof ctx.get === 'function' ? ctx.get('systemPrompt') : undefined
  if (systemPrompt !== undefined) {
    ctx.effect(() => systemPrompt.section(PROMPT_SECTION), 'mermaid-pele: diagram guidance')
  }
}
