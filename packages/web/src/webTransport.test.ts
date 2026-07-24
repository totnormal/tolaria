/**
 * Tests for webTransport — the REST client that replaces @tauri-apps/api/core invoke.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { webInvoke, login, logout, isAuthenticated, resetApiAvailability } from './webTransport'

function mockFetchJson(data: unknown, _ok?: boolean, status = 200) {
  void _ok
  return Promise.resolve(new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }))
}

function mockFetchError(message: string, status = 500) {
  return Promise.resolve(new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  }))
}

describe('webTransport', () => {
  let fetchSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchSpy = vi.fn()
    // Assign directly to globalThis — vi.stubGlobal may not propagate to ESM modules
    globalThis.fetch = fetchSpy as typeof fetch
    resetApiAvailability()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // Restore original fetch
    delete (globalThis as Record<string, unknown>).fetch
  })

  describe('webInvoke — vault commands', () => {
    it('routes list_vault to POST /api/vault/list', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchJson({ status: 'ok' })) // health
      fetchSpy.mockResolvedValueOnce(mockFetchJson({ notes: [{ path: 'test.md', title: 'Test' }] }))

      const result = await webInvoke('list_vault', { path: '/vault' } as never)

      expect(result).toEqual({ notes: [{ path: 'test.md', title: 'Test' }] })
      expect(fetchSpy).toHaveBeenLastCalledWith(
        '/api/vault/list',
        expect.objectContaining({
          method: 'POST',
        })
      )
      // Body includes path + reload:false
      const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1]
      const body = JSON.parse(lastCall[1].body)
      expect(body.path).toBe('/vault')
      expect(body.reload).toBe(false)
    })

    it('routes save_note_content to POST /api/vault/save', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchJson({ status: 'ok' }))
      fetchSpy.mockResolvedValueOnce(mockFetchJson({ ok: true }))

      await webInvoke('save_note_content', {
        path: 'notes/test.md',
        content: '# Hello',
      } as never)

      expect(fetchSpy).toHaveBeenLastCalledWith(
        '/api/vault/save',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ path: 'notes/test.md', content: '# Hello' }),
        })
      )
    })

    it('routes delete_note to POST /api/vault/delete', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchJson({ status: 'ok' }))
      fetchSpy.mockResolvedValueOnce(mockFetchJson({ ok: true }))

      await webInvoke('delete_note', { path: 'notes/old.md' } as never)

      expect(fetchSpy).toHaveBeenLastCalledWith(
        '/api/vault/delete',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ path: 'notes/old.md' }),
        })
      )
    })
  })

  describe('webInvoke — git commands', () => {
    it('routes git_commit to POST /api/git/commit', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchJson({ status: 'ok' }))
      fetchSpy.mockResolvedValueOnce(mockFetchJson({ hash: 'abc123', message: 'ok' }))

      const result = await webInvoke('git_commit', {
        message: 'test commit',
        files: ['a.md'],
      } as never)

      expect(result).toEqual({ hash: 'abc123', message: 'ok' })
      expect(fetchSpy).toHaveBeenLastCalledWith(
        '/api/git/commit',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ message: 'test commit', files: ['a.md'] }),
        })
      )
    })

    it('routes get_modified_files to POST /api/git/status', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchJson({ status: 'ok' }))
      fetchSpy.mockResolvedValueOnce(mockFetchJson({ modified: ['a.md'], staged: [] }))

      await webInvoke('get_modified_files', { path: '/vault' } as never)

      expect(fetchSpy).toHaveBeenLastCalledWith(
        '/api/git/status',
        expect.objectContaining({ method: 'POST' })
      )
    })
  })

  describe('webInvoke — error handling', () => {
    it('throws when API server is unavailable', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('ECONNREFUSED'))

      await expect(webInvoke('list_vault')).rejects.toThrow(/API server not available/)
    })

    it('throws on unknown command', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchJson({ status: 'ok' }))

      await expect(webInvoke('nonexistent_command_xyz')).rejects.toThrow(/No web handler/)
    })

    it('throws with server error message on non-OK response', async () => {
      fetchSpy.mockResolvedValueOnce(mockFetchJson({ status: 'ok' }))
      fetchSpy.mockResolvedValueOnce(mockFetchError('File not found', 404))

      await expect(
        webInvoke('get_note_content', { path: 'missing.md' } as never)
      ).rejects.toThrow('File not found')
    })
  })

  describe('auth (cookie-based)', () => {
    it('login POSTs /api/auth/login with credentials included and stores no token', async () => {
      fetchSpy.mockImplementation((url: string) => {
        if (url === '/api/auth/login') return mockFetchJson({ user: { userId: 'admin' } })
        return mockFetchJson({ error: 'unexpected' }, false, 404)
      })

      await login('admin', 'password')

      const call = fetchSpy.mock.calls.find((c) => c[0] === '/api/auth/login') as unknown as [string, RequestInit]
      expect(call).toBeDefined()
      expect(call[1]).toMatchObject({ method: 'POST', credentials: 'include' })
      expect(JSON.parse(String(call[1].body))).toEqual({ username: 'admin', password: 'password' })
    })

    it('logout POSTs /api/auth/logout with credentials included', async () => {
      fetchSpy.mockResolvedValue(mockFetchJson({ ok: true }))

      await logout()

      const call = fetchSpy.mock.calls.find((c) => c[0] === '/api/auth/logout') as unknown as [string, RequestInit]
      expect(call).toBeDefined()
      expect(call[1]).toMatchObject({ method: 'POST', credentials: 'include' })
    })

    it('isAuthenticated returns true on 200 from /api/auth/me', async () => {
      fetchSpy.mockImplementation((url: string) => {
        if (url === '/api/auth/me') return mockFetchJson({ user: { userId: 'admin' } })
        return mockFetchJson({ error: 'no' }, false, 404)
      })

      expect(await isAuthenticated()).toBe(true)
    })

    it('isAuthenticated returns false on 401 from /api/auth/me', async () => {
      fetchSpy.mockImplementation((url: string) => {
        if (url === '/api/auth/me') return mockFetchJson({ error: 'unauthorized' }, false, 401)
        return mockFetchJson({ error: 'no' }, false, 404)
      })

      expect(await isAuthenticated()).toBe(false)
    })
  })
})
