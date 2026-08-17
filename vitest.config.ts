import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Separate from vite.config.ts on purpose: tests don't need the TanStack
// Router codegen plugin (routes are tested as plain components).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // The render tests pull in the scoring engine and its data tables. On a
    // cold module cache (every CI run) that pushed them past the 5s default
    // and made the suite flaky; 15s is still fast enough to catch a hang.
    testTimeout: 15_000,
  },
})
