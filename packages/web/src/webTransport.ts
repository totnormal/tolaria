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

/** Reset cached API availability (for testing or reconnection). */
export function resetApiAvailability(): void {
  _apiAvailable = null
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

// ── Auth headers ─────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = getAuthToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
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
    const res = await fetch('/api/vault/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ path: payload.path, reload: cmd === 'reload_vault' }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'get_note_content' || cmd === 'validate_note_content') {
    const params = new URLSearchParams({ path: payload.path as string })
    const res = await fetch(`/api/vault/content?${params}`, { headers: { ...authHeaders() } })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    const data = await res.json()
    return (cmd === 'validate_note_content' ? (data.content === payload.content) : data.content) as unknown as T
  }
  if (cmd === 'get_all_content') {
    const params = new URLSearchParams({ path: payload.path as string })
    const res = await fetch(`/api/vault/all-content?${params}`, { headers: { ...authHeaders() } })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'reload_vault_entry') {
    const params = new URLSearchParams({ path: payload.path as string })
    const res = await fetch(`/api/vault/entry?${params}`, { headers: { ...authHeaders() } })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'save_note_content') {
    const res = await fetch('/api/vault/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ path: payload.path, content: payload.content }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'create_note_content') {
    const res = await fetch('/api/vault/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ path: payload.path, content: payload.content }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'rename_note') {
    const res = await fetch('/api/vault/rename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'rename_note_filename') {
    const res = await fetch('/api/vault/rename-filename', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'delete_note') {
    const res = await fetch('/api/vault/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ path: payload.path }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'search_vault') {
    const params = new URLSearchParams({
      vault_path: payload.vault_path as string,
      query: payload.query as string,
      exclude_frontmatter: payload.excludeFrontmatter ? 'true' : 'false',
    })
    const res = await fetch(`/api/vault/search?${params}`, { headers: { ...authHeaders() } })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }

  // ── Git commands ───────────────────────────────────────────────────
  if (cmd === 'get_modified_files') {
    const res = await fetch('/api/git/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ path: payload.path || payload.vault_path }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'get_file_diff') {
    const res = await fetch('/api/git/diff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'get_file_diff_at_commit') {
    const res = await fetch('/api/git/diff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'get_file_history') {
    const res = await fetch('/api/git/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'get_vault_pulse') {
    const res = await fetch('/api/git/pulse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'git_commit') {
    const res = await fetch('/api/git/commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'git_pull') {
    const res = await fetch('/api/git/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'git_push') {
    const res = await fetch('/api/git/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'git_remote_status') {
    const res = await fetch('/api/git/remote-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'get_last_commit_info') {
    const res = await fetch('/api/git/last-commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'git_author_identity') {
    const res = await fetch('/api/git/author-identity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'git_file_url') {
    const res = await fetch('/api/git/file-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'is_git_repo' || cmd === 'git_workspace_info') {
    const res = await fetch('/api/git/is-repo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ path: payload.path || payload.vault_path }),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }

  // ── Settings commands ──────────────────────────────────────────────
  if (cmd === 'get_settings') {
    const res = await fetch('/api/settings', { headers: { ...authHeaders() } })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'save_settings') {
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload.settings || payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'load_vault_list') {
    const res = await fetch('/api/settings/vault-list', { headers: { ...authHeaders() } })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
  }
  if (cmd === 'save_vault_list') {
    const res = await fetch('/api/settings/vault-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(payload),
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
    return res.json()
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
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({ error: res.statusText }))).error || `API error ${res.status}`)
  const data = await res.json()
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