/**
 * Web entry point for Tolaria — replaces src/main.tsx in browser builds.
 *
 * Vite resolves @tauri-apps/api/* to our shim via resolve.alias,
 * so upstream src/ code works unmodified.
 */
import { lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import '../../../src/index.css'
import { AuthGate } from './AuthGate'
import { StartupShellFallback } from '../../../src/components/StartupShellFallback'

// Lazy-load the upstream App (heavy chunk with all Tauri IPC)
const LazyUpstreamApp = lazy(async () => {
  const mod = await import('../../../src/App.tsx')
  return { default: mod.default }
})

  const root = document.getElementById('root')
  if (!root) throw new Error('Tolaria root element is missing')
  createRoot(root).render(
  <Suspense fallback={<StartupShellFallback />}>
    <AuthGate>
      <LazyUpstreamApp />
    </AuthGate>
  </Suspense>,
)
