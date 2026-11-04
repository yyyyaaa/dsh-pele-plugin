/**
 * Build `client.pele.js`, the package-local Client chunk that carries Pele.
 *
 * The browser bundle is served by dsh-client-modules from beside `client.js`
 * and is fetched on demand by `require.async('./client.pele.js')`, so the
 * renderer costs nothing until a diagram appears. Pele has no dependencies, so
 * esbuild can emit one self-contained CommonJS body; the wrapper below is the
 * module-loader registration a chunk file must perform.
 *
 * Run with: node scripts/build-pele-chunk.mjs
 */
import { build } from 'esbuild'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const chunkFile = 'client.pele.js'

const result = await build({
  stdin: {
    contents: 'export * from "pele"',
    resolveDir: root,
    sourcefile: 'pele-entry.js',
    loader: 'js',
  },
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2020',
  minify: true,
  legalComments: 'none',
  charset: 'utf8',
  write: false,
  logLevel: 'warning',
})

if (result.outputFiles.length !== 1) throw new Error(`expected one output file, got ${result.outputFiles.length}`)
const code = result.outputFiles[0].text.trimEnd()

const wrapped = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(pkg.name)},
\tchunk: ${JSON.stringify(chunkFile)},
\tfactory: () => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
${code}
\t\treturn module.exports;
\t}
});
`

await writeFile(join(root, chunkFile), wrapped)
const bytes = Buffer.byteLength(wrapped)
console.log(`wrote ${chunkFile}: ${(bytes / 1024).toFixed(1)} KiB from pele ${pkg.dependencies.pele}`)
