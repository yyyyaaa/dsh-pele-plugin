import { describe, expect, it } from 'vitest'
import { apply, inject } from '../src/host/index.ts'
import type { DiagramValue, HostContext } from '../src/host/index.ts'

/** The subset of the registered tool the tests drive. */
interface RegisteredTool {
  readonly name: string
  readonly description: string
  readonly parameters: Record<string, { readonly type?: string; readonly required?: boolean }>
  readonly output: {
    render(args: unknown, value: DiagramValue): { readonly type: string; readonly text: string }[]
  }
  execute(args: { source: string; title?: string }): Promise<DiagramValue>
}

interface PromptSection {
  readonly name: string
  readonly order: number
  readonly text: string
}

/** Apply the plugin to a recording context and return what it registered. */
function setup(): {
  tool: RegisteredTool
  section: PromptSection | undefined
  disposed: () => number
} {
  let tool: RegisteredTool | undefined
  let section: PromptSection | undefined
  let disposed = 0

  const ctx: HostContext = {
    tools: {
      register(definition) {
        // The registry hands back opaque definitions; each test asserts the
        // shape it drives field by field.
        tool = definition as RegisteredTool
        return () => {}
      },
    },
    effect(callback) {
      callback()
      return () => {
        disposed += 1
      }
    },
    get(name) {
      if (name !== 'systemPrompt') return undefined
      return {
        section(value: PromptSection) {
          section = value
          return () => {
            disposed += 1
          }
        },
      }
    },
  }

  apply(ctx)
  if (tool === undefined) throw new Error('the mermaid tool did not register')
  return { tool, section, disposed: () => disposed }
}

describe('mermaid host tool', () => {
  it('declares its tool dependency and registers under the wire name', () => {
    const { tool } = setup()
    expect(inject).toEqual(['tools'])
    expect(tool.name).toBe('mermaid')
    expect(tool.parameters.source?.required).toBe(true)
    expect(tool.parameters.source?.type).toBe('string')
    expect(tool.description).toMatch(/Mermaid diagram/)
  })

  it('renders valid source and reports the type and laid-out size', async () => {
    const { tool } = setup()
    const value = await tool.execute({ source: 'flowchart LR\n  A[Input] --> B[Output]' })

    expect(value.type).toBe('flowchart')
    expect(value.mermaidType).toBe('flowchart-v2')
    expect(value.width).toBeGreaterThan(0)
    expect(value.height).toBeGreaterThan(0)
    expect(Object.keys(value).sort()).toEqual(['height', 'mermaidType', 'type', 'width'])

    const rendered = tool.output.render({}, value)
    expect(rendered).toHaveLength(1)
    expect(rendered[0]?.type).toBe('text')
    expect(rendered[0]?.text).toMatch(/flowchart-v2 diagram/)
  })

  it('names the line and column for invalid source', async () => {
    const { tool } = setup()
    await expect(tool.execute({ source: 'flowchart LR\n  A --> \n  ??? nope' }))
      .rejects.toThrow(/mermaid could not render this flowchart \(syntax at line 3, column 7\)/)
    await expect(tool.execute({ source: 'flowchart LR\n  A --> \n  ??? nope' }))
      .rejects.toThrow(/Parse error on line 3/)
  })

  it('rejects empty source', async () => {
    const { tool } = setup()
    await expect(tool.execute({ source: '   ' })).rejects.toThrow(/`source` is empty/)
  })

  it('registers standing guidance before the environment suffix', () => {
    const { section, disposed } = setup()
    expect(section?.name).toBe('mermaid-diagrams')
    expect(section?.order).toBeLessThan(10_000)
    expect(section?.text).toMatch(/`mermaid` tool/)
    expect(section?.text).toMatch(/fenced code block/)
    expect(disposed()).toBe(0)
  })
})
