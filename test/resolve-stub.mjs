/**
 * Resolve the one Host API this bundle imports to a local stub, so the tool
 * definition can be exercised without a running Harness process.
 */
import { register } from 'node:module'

register('./tools-stub-loader.mjs', import.meta.url)
