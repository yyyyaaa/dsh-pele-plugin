import { fileURLToPath } from 'node:url'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig } from 'vitest/config'

/** The Host bundle imports the harness tool registry; tests substitute a stub. */
const toolsStub = fileURLToPath(new URL('./test/tools-stub.ts', import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '@deepseek-ai/dsh-tools': toolsStub },
  },
  test: {
    projects: [
      {
        test: {
          name: 'host',
          environment: 'node',
          include: ['test/host.test.ts'],
        },
      },
      {
        test: {
          name: 'browser',
          include: ['test/browser.test.ts'],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
})
