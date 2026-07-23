# Assessment — Tolaria Web (inherited state, 2026-07-23)

Technical audit of the work Hermes Agent had completed before this project was formalised. Source of the findings; the forward plan is in `PLAN.md`.

## Project located

- **Path:** `/root/.hermes/hermes-agent/root/workspace/tolaria/tolaria` (VPS "all" = SSH `hetzner-claw`, hostname `all-docker`).
- Fork of upstream Tolaria (`refactoringhq/tolaria`, author `lucaronin`); origin = `github.com/totnormal/tolaria`, branch `main` == `origin/main` @ `b6d6bc75`.
- Runtime data dir: `/root/.tolaria-web/{users.json, users/admin, vaults/admin}`.

## What Tolaria is

Native macOS note app (Tauri 2 + React), files-first/git-first/offline-first. Notes = markdown + YAML frontmatter; whiteboards (tldraw), sheets, views. Ships an MCP server (`mcp-server/{index.js,ws-bridge.js}`) exposing ~30 vault/git commands to AI agents. Real desktop vault: `~/Library/Mobile Documents/com~apple~CloudDocs/Tolaria` (1,856 md), remote `totnormal/tolaria-vault`.

## Architecture inherited

- **Frontend:** upstream React app + Hermes' `src/mock-tauri` edit + `src/lib/webTransport.ts` + `src/components/LoginPage.tsx`, wiring `invoke()` → REST.
- **Backend (Hermes):** `packages/server` — Express 4.21, JWT + bcrypt + gray-matter + ws. Routes: vault CRUD+search, git ops, auth, settings.
- **Deploy:** nginx `tolaria-web` (`/api/`→`:3200`, `/`→`:5202`); edge = Cloudflare (TLS/HSTS). Processes are children of the **Hermes WebUI python** process, not systemd.

## Progress by area

| Area | Status | Evidence |
|---|---|---|
| Frontend web port (vault CRUD) | Partial | webTransport routes ~30 cmds; mock-tauri edited |
| Backend REST (vault+git) | Mostly complete | all routes respond; `/api/health`→200 |
| Auth | Partial | works; default pw `tolaria`, token in localStorage, no rate-limit |
| **Public access** | **Broken** | `curl https://tolaria.tarnovski.com` → **526** |
| Process durability | Missing | no systemd; children of hermes-webui |
| Production build | Missing | no `dist/`; serves Vite dev (`@react-refresh`) |
| TLS at origin | Partial | nginx port-80 only; tunnel lacks tolaria ingress |
| PWA | Missing | no manifest/sw/`vite-plugin-pwa` |
| AI/MCP in web | Missing | `/api/mcp/info`→`available:false` |
| Real-vault integration | Partial | web vault = 1,330 junk seed files |
| Server tests | Missing | 0 test files |
| Secrets handling | Broken | env lacks `TOLARIA_JWT_SECRET`/`ADMIN_PASSWORD` |
| Version control of new work | Was missing | all web files were untracked (now committed to `feat/web-layer`) |

**Overall: ~35–45% complete.**

## Verified at audit time

- `curl http://127.0.0.1:3200/api/health` → `200 {"status":"ok","version":"0.1.0"}`
- `curl http://127.0.0.1:5202/` → `200` Vite dev HTML
- `curl https://tolaria.tarnovski.com/` → `HTTP/2 526`
- `/root/.cloudflared/config.yml` ingress routes only `hermes.tarnovski.com`→8789; no tolaria ingress (root cause of 526)
- `/proc/<pid>/environ`: no `TOLARIA_JWT_SECRET`/`TOLARIA_ADMIN_PASSWORD` → defaults live
- `gitOps.ts` uses `execFileSync('git', args, {cwd})` → **no shell injection**; but route handlers pass raw `path`/`vault_path` → path-traversal (only `listVault` uses `resolveInside`)

## Top risks (full detail in PLAN/ARCHITECTURE)

- **Critical:** public 526; all web work was uncommitted; default creds + random JWT secret on an about-to-be-exposed app.
- **High:** path-traversal in vault/git routes; dev server in prod; non-durable process; token in localStorage + no CSP + permissive CORS.
- **Medium:** junk/divergent vault; AI bridge absent; duplicated vault logic (vite middleware vs server).
- **Low:** no rate-limit; no server tests; `/api/auth/me` not behind `requireAuth`.

## Delivery recommendation (accepted)

Responsive **PWA** (the codebase is already React+Vite → low effort, high value) served via the **Cloudflare Tunnel**; then **Capacitor** wraps the same build for iOS. No native/RN/Flutter rewrite.
