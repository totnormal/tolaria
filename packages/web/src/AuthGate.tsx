/**
 * AuthGate — login wrapper for web builds.
 *
 * Checks for a valid auth token on mount. Shows LoginPage if not authenticated,
 * renders children if authenticated.
 */
import { useState, useEffect, type ReactNode } from 'react'
import { getAuthToken, isWebAvailable } from './webTransport'
import { LoginPage } from './LoginPage'

interface Props {
  children: ReactNode
}

export function AuthGate({ children }: Props) {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)

  useEffect(() => {
    async function check() {
      const token = getAuthToken()
      if (!token) {
        setAuthenticated(false)
        return
      }
      const available = await isWebAvailable()
      setAuthenticated(available)
    }
    check()
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
