/**
 * AuthGate — login wrapper for web builds.
 *
 * Checks for a valid session cookie on mount (GET /api/auth/me). Shows
 * LoginPage when unauthenticated, renders children when authenticated.
 */
import { useState, useEffect, type ReactNode } from 'react'
import { isAuthenticated } from './webTransport'
import { LoginPage } from './LoginPage'

interface Props {
  children: ReactNode
}

export function AuthGate({ children }: Props) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const ok = await isAuthenticated()
      if (!cancelled) setAuthenticated(ok)
    }
    check()
    return () => { cancelled = true }
  }, [])

  // Loading state
  if (authenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-zinc-500">Loading...</div>
      </div>
    )
  }

  // Not authenticated — show login
  if (!authenticated) {
    return <LoginPage onLoginSuccess={() => setAuthenticated(true)} />
  }

  // Authenticated — render the app
  return <>{children}</>
}
