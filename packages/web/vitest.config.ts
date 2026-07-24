import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      // Mirror the production alias so tests exercise the same resolution
      '@tauri-apps/api/core': path.resolve(__dirname, 'src/tauriShim.ts'),
      '@tauri-apps/api/window': path.resolve(__dirname, 'src/stubs/window.ts'),
      '@tauri-apps/api/event': path.resolve(__dirname, 'src/stubs/event.ts'),
      '@tauri-apps/api/webviewWindow': path.resolve(__dirname, 'src/stubs/webviewWindow.ts'),
      '@tauri-apps/plugin-opener': path.resolve(__dirname, 'src/stubs/browserOpener.ts'),
      '@tauri-apps/plugin-dialog': path.resolve(__dirname, 'src/stubs/dialog.ts'),
      '@tauri-apps/plugin-updater': path.resolve(__dirname, 'src/stubs/updater.ts'),
      '@tauri-apps/plugin-global-shortcut': path.resolve(__dirname, 'src/stubs/globalShortcut.ts'),
      '@tauri-apps/plugin-deep-link': path.resolve(__dirname, 'src/stubs/deepLink.ts'),
      '@tauri-apps/plugin-process': path.resolve(__dirname, 'src/stubs/process.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
    },
  },
})
