/**
 * Browser entry point.
 *
 * The client module system loads this bundle and calls the factory; the factory
 * receives the `require` that resolves platform seeds and this package's Pele
 * chunk. Everything else lives in modules that the bundler inlines above this
 * call.
 */
import { createPlugin, PLUGIN_ID } from './plugin.ts'

const loader = window.__ModuleLoader__
if (loader === undefined) {
  throw new Error('mermaid: the client module loader is unavailable on this page.')
}

loader.load({
  id: PLUGIN_ID,
  factory: (require) => createPlugin(require),
})
