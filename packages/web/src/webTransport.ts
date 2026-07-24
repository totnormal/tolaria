/**
 * Web Transport Layer — replaces @tauri-apps/api/core invoke for browser mode.
 *
 * Routes Tauri commands to the Express server REST API at /api/*.
 */

let _authToken: string | null = null
let _apiAvailable: boolean | null = null

// ── Auth token management ────────────────────────────────────────────────

export function setAuthToken(token: string | null): void {
  _authToken = token
  if (token) {
    try { localStorage.setItem('tolaria-web-token', token) } catch { /* noop */ }
  } else {
    try { localStorage.removeItem('tolaria-web-token') } catch { /* noop */ }
  }
}

export function getAuthToken(): string | null {
  if (_authToken) return _authToken
  try {
    _authToken = localStorage.getItem('tolaria-web-token')
  } catch { /* noop */ }
  return _authToken
}

// ── API availability check ───────────────────────────────────────────────

async function checkApiAvailable(): Promise<boolean> {
  if (_apiAvailable === true) return true
  try {
    const res = await fetch('/api/health', { signal: AbortSignal.timeout(3000) })
    _apiAvailable = res.ok
    return _apiAvailable
  } catch {
    _apiAvailable = false
    return false
  }
}

/** Reset cached API availability (for testing or reconnection). */
export function resetApiAvailability(): void {
  _apiAvailable = null
}

// ── Fetch helpers ────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function apiGet<T>(path: string, params?: Record<string, unknown>): Promise<T> {
  const searchParams = params
    ? '?' + new URLSearchParams(
        Object.entries(params).map(([k, v]) => [k, String(v)])
      ).toString()
    : ''
  const res = await fetch(`/api${path}${searchParams}`, {
    headers: { ...authHeaders() },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `API error ${res.status}`)
  }
  return res.json()
}

async function apiPost<T>(path: string, body?: Record<string, unknown>): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || `API error ${res.status}`)
  }
  return res.json()
}

// ── Command routing ──────────────────────────────────────────────────────

function extractArgs(args?: Record<string, unknown>): Record<string, unknown> {
  if (!args) return {}
  // Unwrap nested Tauri args format: { args: { path: '...' } }
  const nested = Reflect.get(args, 'args')
  if (nested && typeof nested === 'object') return nested as Record<string, unknown>
  return args
}

async function routeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T | undefined> {
  const payload = extractArgs(args)

  // ── Vault commands ─────────────────────────────────────────────────
  if (cmd === 'list_vault' || cmd === 'reload_vault') {
    return apiPost<T>('/vault/list', { path: payload.path, reload: cmd === 'reload_vault' })
  }
  if (cmd === 'get_note_content' || cmd === 'validate_note_content') {
    const data = await apiGet<{ content: string }>('/api/vault/content', { path: payload.path as string })
    return (cmd === 'validate_note_content' ? (data.content === payload.content) : data.content) as unknown as T
  }
  if (cmd === 'get_all_content') {
    return apiGet<T>('/vault/all-content', { path: payload.path as string })
  }
  if (cmd === 'reload_vault_entry') {
    return apiGet<T>('/vault/entry', { path: payload.path as string })
  }
  if (cmd === 'save_note_content') {
    return apiPost<T>('/vault/save', { path: payload.path, content: payload.content })
  }
  if (cmd === 'create_note_content') {
    return apiPost<T>('/vault/create', { path: payload.path, content: payload.content })
  }
  if (cmd === 'rename_note') {
    return apiPost<T>('/vault/rename', payload)
  }
  if (cmd === 'rename_note_filename') {
    return apiPost<T>('/vault/rename-filename', payload)
  }
  if (cmd === 'delete_note') {
    return apiPost<T>('/vault/delete', { path: payload.path })
  }
  if (cmd === 'search_vault') {
    return apiGet<T>('/vault/search', {
      vault_path: payload.vault_path as string,
      query: payload.query as string,
      exclude_frontmatter: payload.excludeFrontmatter ? 'true' : 'false',
    })
  }

  // ── Git commands ───────────────────────────────────────────────────
  if (cmd === 'get_modified_files') {
    return apiPost<T>('/git/status', { path: payload.path || payload.vault_path })
  }
  if (cmd === 'get_file_diff') {
    return apiPost<T>('/git/diff', payload)
  }
  if (cmd === 'get_file_diff_at_commit') {
    return apiPost<T>('/git/diff', payload)
  }
  if (cmd === 'get_file_history') {
    return apiPost<T>('/git/history', payload)
  }
  if (cmd === 'get_vault_pulse') {
    return apiPost<T>('/git/pulse', payload)
  }
  if (cmd === 'git_commit') {
    return apiPost<T>('/git/commit', payload)
  }
  if (cmd === 'git_pull') {
    return apiPost<T>('/git/pull', payload)
  }
  if (cmd === 'git_push') {
    return apiPost<T>('/git/push', payload)
  }
  if (cmd === 'git_remote_status') {
    return apiPost<T>('/git/remote-status', payload)
  }
  if (cmd === 'get_last_commit_info') {
    return apiPost<T>('/git/last-commit', payload)
  }
  if (cmd === 'git_author_identity') {
    return apiPost<T>('/git/author-identity', payload)
  }
  if (cmd === 'git_file_url') {
    return apiPost<T>('/git/file-url', payload)
  }
  if (cmd === 'is_git_repo' || cmd === 'git_workspace_info') {
    return apiPost<T>('/git/is-repo', { path: payload.path || payload.vault_path })
  }

  // ── Settings commands ──────────────────────────────────────────────
  if (cmd === 'get_settings') {
    return apiGet<T>('/settings')
  }
  if (cmd === 'save_settings') {
    return apiPost<T>('/settings', payload.settings || payload)
  }
  if (cmd === 'load_vault_list') {
    return apiGet<T>('/settings/vault-list')
  }
  if (cmd === 'save_vault_list') {
    return apiPost<T>('/settings/vault-list', payload)
  }

  return undefined
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Web-native invoke — replaces @tauri-apps/api/core invoke.
 * Routes commands to the Express server when available.
 */
export async function webInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const available = await checkApiAvailable()
  if (!available) {
    throw new Error(`Tolaria API server not available for command: ${cmd}`)
  }

  const result = await routeCommand<T>(cmd, args)
  if (result !== undefined) return result

  throw new Error(`No web handler for command: ${cmd}`)
}

/**
 * Login to the web API server.
 */
export async function login(username: string, password: string): Promise<void> {
  const data = await apiPost<{ token: string }>('/auth/login', { username, password })
  setAuthToken(data.token)
}

/**
 * Check if the web API server is available and the user is authenticated.
 */
export async function isWebAvailable(): Promise<boolean> {
  const token = getAuthToken()
  if (!token) return false
  return checkApiAvailable()
}

export function logout(): void {
  setAuthToken(null)
}
