import { defineConfig } from 'vitest/config'

// Server-side tests run in Node (no jsdom). Kept separate from the root
// vite config, which scopes vitest to src/** for the frontend coverage gate.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
})
