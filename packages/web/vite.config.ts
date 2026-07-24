import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // Intercept Tauri API imports → our browser shims
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
      // App code resolves from the repo root (upstream src/)
      '@': path.resolve(__dirname, '../../src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
})
