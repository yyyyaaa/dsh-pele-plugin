/**
 * Build the three artifacts this plugin ships.
 *
 * - `dist/index.js` — the Host entry the loader imports (ESM).
 * - `dist/client.js` — the browser bundle the client module system executes.
 * - `dist/client.pele.js` — a lazy package-local chunk, wrapped in the
 *   `__ModuleLoader__.load` registration the loader expects for chunks.
 *
 * Rolldown compiles the TypeScript sources; this script only supplies the two
 * wrappers and the file layout.
 */
import { mkdir, readFile, rm, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { build } from 'rolldown'

const root = fileURLToPath(new URL('../', import.meta.url))
const dist = `${root}dist/`
const source = (path: string): string => `${root}src/${path}`
const pkg: { name: string } = JSON.parse(await readFile(`${root}package.json`, 'utf8'))

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })

/**
 * The three bundles are independent, so they build concurrently: the Host entry
 * (ESM, harness and Pele resolved by the runtime), the browser entry (the bundle
 * performs its own module-loader registration), and the Pele chunk (a CommonJS
 * body wrapped in the registration `require.async` expects).
 */
await Promise.all([
  build({
    input: source('host/index.ts'),
    platform: 'node',
    external: ['@deepseek-ai/dsh-tools', 'pele'],
    output: { file: `${dist}index.js`, format: 'esm' },
  }),
  build({
    input: source('client/main.ts'),
    platform: 'browser',
    output: { file: `${dist}client.js`, format: 'iife' },
  }),
  build({
    input: source('client/pele-entry.ts'),
    platform: 'browser',
    output: {
      file: `${dist}client.pele.js`,
      format: 'cjs',
      minify: true,
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pkg.name)}, chunk: "client.pele.js", factory: () => { var module = { exports: {} }; var exports = module.exports;\n`,
      footer: '\nreturn module.exports; } });\n',
    },
  }),
])

for (const file of ['index.js', 'client.js', 'client.pele.js']) {
  const { size } = await stat(`${dist}${file}`)
  console.log(`${file.padEnd(16)} ${(size / 1024).toFixed(1)} KiB`)
}
