/**
 * Package-local chunk entry.
 *
 * The build wraps this module's CommonJS body in a `__ModuleLoader__.load` call
 * with `chunk: "client.pele.js"`, so `require.async` in the main bundle resolves
 * exactly this file. Pele is pure ESM, which is why the wrapper exists at all.
 */
export * from 'pele'
