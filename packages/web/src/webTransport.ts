/**
 * Web Transport Layer — replaces @tauri-apps/api/core invoke for browser mode.
 *
 * Routes Tauri commands to the Express server REST API at /api/*.
 *
 * Auth model: the JWT lives in an HttpOnly cookie set by the server, so there
 * is no token in JS memory or localStorage (XSS-safe). Every request is sent
 * with `credentials: 'include'` so the cookie rides along automatically.
 *
 * IMPORTANT: every `fetch()` call uses a *literal* endpoint string as its URL
 * (never a variable derived from user input). The request target is therefore
 * never client-controlled — there is no SSRF surface. The helpers below only
 * build the fetch *init* (method/headers/body/credentials), not the URL.
 */

let _apiAvailable: boolean | null = null

function jsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' }
}

/** A GET init that carries the auth cookie (+ optional extras). */
function withCreds(extra: RequestInit = {}): RequestInit {
  return { credentials: 'include', ...extra }
}

/** A POST init for a JSON body that carries the auth cookie. */
function postInit(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: jsonHeaders(),
    body: JSON.stringify(body),
    credentials: 'include',
  }
}

async function readError(res: Response): Promise<string> {
  const data = await res.json().catch(() => ({ error: res.statusText }))
  return (data as { error?: string }).error || `API error ${res.status}`
}

// ── API availability check ───────────────────────────────────────────────

async function checkApiAvailable(): Promise<boolean> {
  if (_apiAvailable === true) return true
  try {
    const res = await fetch('/api/health', withCreds({ signal: AbortSignal.timeout(3000) }))
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
    const res = await fetch('/api/vault/list', postInit({ path: payload.path, reload: cmd === 'reload_vault' }))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'get_note_content' || cmd === 'validate_note_content') {
    const params = new URLSearchParams({ path: payload.path as string })
    const res = await fetch(`/api/vault/content?${params}`, withCreds())
    if (!res.ok) throw new Error(await readError(res))
    const data = await res.json()
    return (cmd === 'validate_note_content' ? (data.content === payload.content) : data.content) as unknown as T
  }
  if (cmd === 'get_all_content') {
    const params = new URLSearchParams({ path: payload.path as string })
    const res = await fetch(`/api/vault/all-content?${params}`, withCreds())
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'reload_vault_entry') {
    const params = new URLSearchParams({ path: payload.path as string })
    const res = await fetch(`/api/vault/entry?${params}`, withCreds())
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'save_note_content') {
    const res = await fetch('/api/vault/save', postInit({ path: payload.path, content: payload.content }))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'create_note_content') {
    const res = await fetch('/api/vault/create', postInit({ path: payload.path, content: payload.content }))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'rename_note') {
    const res = await fetch('/api/vault/rename', postInit(payload))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'rename_note_filename') {
    const res = await fetch('/api/vault/rename-filename', postInit(payload))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'delete_note') {
    const res = await fetch('/api/vault/delete', postInit({ path: payload.path }))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'search_vault') {
    const params = new URLSearchParams({
      vault_path: payload.vault_path as string,
      query: payload.query as string,
      exclude_frontmatter: payload.excludeFrontmatter ? 'true' : 'false',
    })
    const res = await fetch(`/api/vault/search?${params}`, withCreds())
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }

  // ── Git commands ───────────────────────────────────────────────────
  if (cmd === 'get_modified_files' || cmd === 'is_git_repo' || cmd === 'git_workspace_info') {
    const res = await fetch('/api/git/status', postInit({ path: payload.path || payload.vault_path }))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'get_file_diff' || cmd === 'get_file_diff_at_commit') {
    const res = await fetch('/api/git/diff', postInit(payload))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'get_file_history') {
    const res = await fetch('/api/git/history', postInit(payload))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'get_vault_pulse') {
    const res = await fetch('/api/git/pulse', postInit(payload))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'git_commit') {
    const res = await fetch('/api/git/commit', postInit(payload))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'git_pull') {
    const res = await fetch('/api/git/pull', postInit(payload))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'git_push') {
    const res = await fetch('/api/git/push', postInit(payload))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'git_remote_status') {
    const res = await fetch('/api/git/remote-status', postInit(payload))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'get_last_commit_info') {
    const res = await fetch('/api/git/last-commit', postInit(payload))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'git_author_identity') {
    const res = await fetch('/api/git/author-identity', postInit(payload))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'git_file_url') {
    const res = await fetch('/api/git/file-url', postInit(payload))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }

  // ── Settings commands ──────────────────────────────────────────────
  if (cmd === 'get_settings') {
    const res = await fetch('/api/settings', withCreds())
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'save_settings') {
    const res = await fetch('/api/settings', postInit(payload.settings || payload))
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'load_vault_list') {
    const res = await fetch('/api/settings/vault-list', withCreds())
    if (!res.ok) throw new Error(await readError(res))
    return res.json()
  }
  if (cmd === 'save_vault_list') {
    const res = await fetch('/api/settings/vault-list', postInit(payload))
    if (!res.ok) throw new Error(await readError(res))
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
 * Login to the web API server. The JWT is set as an HttpOnly cookie by the
 * server — nothing is stored in JS / localStorage.
 */
export async function login(username: string, password: string): Promise<void> {
  const res = await fetch('/api/auth/login', postInit({ username, password }))
  if (!res.ok) throw new Error(await readError(res))
}

/** Log out — clears the auth cookie server-side. */
export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', postInit(null)).catch(() => { /* best-effort */ })
}

/** True when the browser has a valid auth session (GET /api/auth/me → 200). */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/me', withCreds({ signal: AbortSignal.timeout(3000) }))
    return res.ok
  } catch {
    return false
  }
}

/** True when the API server is reachable. */
export async function isApiAvailable(): Promise<boolean> {
  return checkApiAvailable()
}
