/**
 * Cheapest reliable check of the Host half: the tool definition registers, a
 * valid diagram returns the declared value and model-facing text, and invalid
 * Mermaid comes back as a fixable error naming the line.
 */
import assert from 'node:assert/strict'

const { apply, inject } = await import('../index.js')

assert.deepEqual(inject, ['tools'], 'the plugin declares its tools service dependency')

let tool
let section
let disposed = 0
const ctx = {
  tools: { register: (definition) => { tool = definition } },
  effect: (callback) => callback(),
  get: (name) => (name === 'systemPrompt'
    ? { section: (value) => { section = value; return () => { disposed += 1 } } }
    : undefined),
}
apply(ctx)

assert.equal(tool.name, 'mermaid')
assert.equal(tool.parameters.source.required, true)
assert.equal(tool.parameters.source.type, 'string')
assert.match(tool.description, /Mermaid diagram/)

assert.equal(section.name, 'mermaid-diagrams', 'registers the standing prompt guidance')
assert.ok(Number.isFinite(section.order), 'the section carries an explicit order')
assert.match(section.text, /`mermaid` tool/, 'the guidance names the tool')
assert.match(section.text, /fenced code block/, 'the guidance forbids fenced diagrams')
assert.equal(disposed, 0, 'the section disposer stays live while the plugin is loaded')

const value = await tool.execute({ source: 'flowchart LR\n  A[Input] --> B[Output]' })
assert.equal(value.type, 'flowchart')
assert.equal(value.mermaidType, 'flowchart-v2')
assert.ok(value.width > 0 && value.height > 0, 'reports a laid-out size')
assert.deepEqual(Object.keys(value).sort(), ['height', 'mermaidType', 'type', 'width'])

const rendered = tool.output.render({}, value)
assert.equal(rendered.length, 1)
assert.equal(rendered[0].type, 'text')
assert.match(rendered[0].text, /flowchart-v2 diagram/)

await assert.rejects(
  () => tool.execute({ source: 'flowchart LR\n  A --> \n  ??? nope' }),
  (error) => {
    assert.match(error.message, /mermaid could not render this flowchart \(syntax at line 3, column 7\)/)
    assert.match(error.message, /Parse error on line 3/)
    return true
  },
)

await assert.rejects(() => tool.execute({ source: '   ' }), /`source` is empty/)

console.log('host tool: register, render, and error paths OK')
