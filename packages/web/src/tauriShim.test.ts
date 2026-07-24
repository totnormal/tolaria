/**
 * Tests for tauriShim — the invoke() replacement that routes to webTransport.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock webTransport before any import of tauriShim
const webInvokeSpy = vi.fn()

vi.mock('./webTransport', () => ({
  webInvoke: webInvokeSpy,
  getAuthToken: vi.fn().mockReturnValue(null),
  setAuthToken: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  isWebAvailable: vi.fn().mockResolvedValue(true),
}))

// Must import after vi.mock
const { invoke } = await import('./tauriShim')

describe('tauriShim', () => {
  beforeEach(() => {
    webInvokeSpy.mockReset()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('exports invoke that delegates to webTransport.webInvoke', async () => {
    webInvokeSpy.mockResolvedValue({ notes: [] })

    const result = await invoke('list_vault', { path: '/vault' })

    expect(webInvokeSpy).toHaveBeenCalledWith('list_vault', { path: '/vault' })
    expect(result).toEqual({ notes: [] })
  })

  it('forwards the command name and args correctly for save_note_content', async () => {
    webInvokeSpy.mockResolvedValue({ ok: true })

    await invoke('save_note_content', { path: 'a.md', content: '# Hi' })

    expect(webInvokeSpy).toHaveBeenCalledWith('save_note_content', {
      path: 'a.md',
      content: '# Hi',
    })
  })

  it('forwards git_commit command correctly', async () => {
    webInvokeSpy.mockResolvedValue({ hash: 'abc' })

    await invoke('git_commit', { message: 'test', files: ['a.md'] })

    expect(webInvokeSpy).toHaveBeenCalledWith('git_commit', {
      message: 'test',
      files: ['a.md'],
    })
  })

  it('propagates errors from webTransport', async () => {
    webInvokeSpy.mockRejectedValue(new Error('API server not available'))

    await expect(invoke('list_vault')).rejects.toThrow('API server not available')
  })
})
