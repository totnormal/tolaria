# Architecture

How Tolaria becomes a mobile-first PWA + iOS app **without diverging from upstream**. Read alongside `DECISIONS.md`.

## The big idea: a build-time alias shim

Tolaria is a Tauri 2 + React app. `@tauri-apps/api/core`'s `invoke()` is called from **142 upstream files**. We cannot edit those files (every upstream update would conflict). Instead, the **web build** resolves `@tauri-apps/api/core` (and each `@tauri-apps/plugin-*`) to **our shim** via Vite `resolve.alias`. Our shim's `invoke(cmd, args)` routes to `webTransport.webInvoke(cmd, args)`, which calls the Express REST API. Result: **zero upstream source files edited.**

```
Browser  ──HTTP/WS──▶  nginx (:80, 127.0.0.1)  ──▶  packages/server (:3200, Express)
   │                                                            │
   │  React app (upstream src/*, untouched)                     ├─ vaultOps → markdown files (the cloned vault)
   │   invoke() ──alias──▶ packages/web/tauriShim.ts            ├─ gitOps   → `git` CLI on the vault repo
   │                          └─▶ webTransport.ts ──fetch──▶ /api/*   └─ aiBridge ──▶ headless `pi` (WS stream)
   │
   └─ Vite PWA: manifest + service worker (offline app shell)
```

## Component layout (target, all additive)

```
packages/
  server/                     # (exists) Express API: routes/{vault,git,auth,settings}, lib/{vaultOps,gitOps}, middleware/{auth,config}
    src/ai/bridge.ts          # NEW (Phase 2): Pi headless bridge + WS streaming
    src/security.ts           # NEW (Phase 1): path-containment guard applied to every handler
  web/                        # NEW (Phase 1): the web shell — a pnpm workspace package
    index.html
    vite.config.ts            # web-only config: resolve.alias['@tauri-apps/api/core'] → ./src/tauriShim.ts, PWA plugin
    src/
      main-web.tsx            # entry: <AuthGate><UpstreamApp/></AuthGate>
      tauriShim.ts            # exports invoke() → webTransport; stubs plugin-* modules
      webTransport.ts         # (moved from ../../src/lib) REST client + token handling (cookie, not localStorage)
      AuthGate.tsx            # login gate, token refresh, redirects
      LoginPage.tsx           # (moved from ../../src/components) mobile-first
    package.json
    tsconfig.json

web-layer/                    # this folder — docs + deploy, no code
  deploy/
    nginx.conf                # the tolaria.tarnovski.com server block
    tolaria-web.service       # systemd unit (Restart=always, EnvironmentFile)
    cloudflared-ingress.yml   # the ingress line to add to /root/.cloudflared/config.yml
    .env.example              # TOLARIA_JWT_SECRET, TOLARIA_ADMIN_PASSWORD, TOLARIA_VAULT_PATH, PI_*
  docs/                       # this file + siblings
```

### The alias (the crux of merge-cleanliness)

In `packages/web/vite.config.ts`:
```ts
resolve: {
  alias: {
    '@tauri-apps/api/core': resolve(__dirname, 'src/tauriShim.ts'),
    '@tauri-apps/plugin-dialog':   resolve(__dirname, 'src/stubs/noop.ts'),
    '@tauri-apps/plugin-updater':  resolve(__dirname, 'src/stubs/noop.ts'),
    '@tauri-apps/plugin-global-shortcut': resolve(__dirname, 'src/stubs/noop.ts'),
    '@tauri-apps/plugin-deep-link': resolve(__dirname, 'src/stubs/noop.ts'),
    '@tauri-apps/plugin-opener':   resolve(__dirname, 'src/stubs/browserOpener.ts'),
    '@tauri-apps/plugin-process':  resolve(__dirname, 'src/stubs/noop.ts'),
    // app code still resolves from the repo root:
    '@': resolve(__dirname, '../../src'),
  },
}
```
`tauriShim.ts` exports `invoke(cmd, args)` that delegates to `webTransport.webInvoke`. Plugins that make no sense in a browser (updater, global-shortcut) become no-ops; `opener` becomes `window.open`. The upstream `src/mock-tauri/` is left untouched (it's upstream's test shim; we don't need it).

## Single-user auth

- One account (`admin`), bcrypt-hashed password in `/root/.tolaria-web/users.json`.
- JWT in an **HttpOnly + SameSite=Strict cookie** (not localStorage — XSS-safe). Short-lived access token + refresh.
- `express-rate-limit` on `/api/auth/login`. Strict CSP. CORS locked to the app origin (or same-origin only once behind the tunnel).
- Path containment: every handler resolves client paths against the vault root and rejects `..`/absolute escapes (`packages/server/src/security.ts`).

## Data flow / git sync

- Vault clone at `/var/lib/tolaria/vault` (or `TOLARIA_VAULT_PATH`) = a clone of `totnormal/tolaria-vault`, SSH-authed via the `github_tolaria` deploy key.
- Reads: `vaultOps` reads markdown + gray-matter frontmatter. Writes: save → fsync → optional auto-commit. Sync: explicit pull/push via the Git panel; auto-push on idle (debounced) to keep desktop & web in step.
- Conflict policy (single user): last-writer-wins per file, with the upstream Tolaria merge UI surfaced for real conflicts.

## AI bridge (full AI, via Pi on the VPS)

- `packages/server/src/ai/bridge.ts` spawns headless `pi` (`pi -p "<prompt>"` or pi's non-interactive/streaming mode) per AI request, pipes tokens to the browser over the existing `ws` connection.
- Model selection forwarded from the frontend (the app already has a model picker). Free models already alive on the VPS (opencode, kilo, mimo, …) cover v1; a paid key is optional.
- The bundled `mcp-server` from the desktop app is **not** run on the VPS — the server's own `/api/vault/*` replaces MCP for AI context (agents read/write via REST).

## PWA

- `vite-plugin-pwa` (GenerateSW) in `packages/web`: precache app shell, runtime-cache read note content, **background-sync** queue for offline writes (flushed on reconnect).
- `manifest.webmanifest`: `display: standalone`, `theme_color`, `background_color`, maskable icons (192/512), `apple-touch-icon`, splash. `orientation: portrait` on phones.
- Offline = app shell + last-synced notes; edits queue and sync. Matches Tolaria's "offline-first" principle.

## iOS (immediately after PWA)

- **Capacitor** wraps `packages/web/dist`: `npx cap add ios`, point `webDir` at the built PWA, reuse the same `/api`. Native add-ons: biometric lock (`@capacitor-community/biometric-auth`), push, share sheet.
- Distribution: TestFlight/sidestep for personal use; App Store only if we later want public distribution.
- **Alternative (documented, not chosen):** Tauri Mobile (iOS) — the app is already Tauri v2, so this is architecturally purest but requires un-shimming; revisit if Capacitor proves limiting.

## What we explicitly do NOT do

- No React-Native / Flutter / native Swift rewrite (throws away the BlockNote/tldraw frontend).
- No editing upstream `src/*` (the alias makes it unnecessary).
- No running the Vite dev server in production.
- No public origin ports (everything behind the cloudflared tunnel, bound to 127.0.0.1).
