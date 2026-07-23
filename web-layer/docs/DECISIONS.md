# Decisions

Locked answers to the open questions from the initial assessment (2026-07-23). These drive the architecture in `ARCHITECTURE.md` and the tasks in `PLAN.md`.

## 1. Vault sync — same git repo

The web app serves the **same vault** as the desktop app: `github.com/totnormal/tolaria-vault`. The VPS clones it; edits round-trip via git push/pull. **Implication:** the server's git routes (`commit/pull/push`) must work end-to-end against this remote using an SSH deploy key, and we must define a conflict policy for concurrent desktop+web edits (last-writer-wins per file + frequent auto-commit is the pragmatic default for a single user).

## 2. Single user

Hardcoded to one user (`admin`). **Implication:** we can drop per-user path machinery, but we **still** enforce path containment (defense in depth) — all client-supplied paths must resolve inside the vault root. No registration, no multi-tenant isolation needed.

## 3. Full AI in the browser; Pi is on the VPS

The AI panel must work remotely. **Pi is installed on the VPS** (`/root/.npm-global/bin/pi`, multiple free models alive). The server bridges browser AI requests to **headless Pi** (one-shot / streaming) and streams the response back over WebSocket/SSE. No external paid API required for v1.

**UI mandate:** the interface must be **optimised for mobile and insanely intuitive**. Mobile-first layout, thumb-reach controls, gesture-friendly editor surface, minimal chrome, fast first paint. Consult design skills (`frontend-design`, mobile UX references) during Phase 4 and bake the principles into components — not an afterthought.

## 4. PWA now → iOS app immediately after

Ship the installable PWA first (satisfies desktop + mobile + iOS-via-Safari "Add to Home Screen"). Immediately after, wrap the **same** web build with **Capacitor** to produce a real iOS app (native shell, shared REST API, optional native modules: biometric lock, push, share). One codebase, two deliverables. App Store distribution is optional (personal use can sideload/TestFlight).

## 5. Edge/TLS — Cloudflare Tunnel (recommended, accepted)

Route `tolaria.tarnovski.com` through the **existing cloudflared tunnel** by adding an ingress (`tolaria.tarnovski.com → http://127.0.0.1:80`). This gives TLS + HSTS for free, hides the origin IP, and needs no origin cert. Origin services bind to `127.0.0.1` only; no public app ports. Cloudflare Access (zero-trust) in front is an optional hardening step.

## Policies

- **Layer, not fork.** Add files only; never edit `src/*`. Vite `resolve.alias` intercepts `@tauri-apps/*` in the web build so the 142 upstream files that call `invoke()` are untouched. (`docs/ARCHITECTURE.md`)
- **Commit + push habitually.** Every meaningful change is a git commit on `feat/web-layer`; push when auth allows. Small, well-described commits. Never leave uncommitted work overnight.
- **No secrets in git.** Secrets live in a gitignored `web-layer/deploy/.env` consumed by systemd `EnvironmentFile`. `.env.example` documents keys without values.
- **Production = built `dist/`, served by systemd.** Never expose the Vite dev server publicly.
- **TDD for our code.** `packages/server` and `packages/web` get vitest tests. (Upstream already enforces TDD in its `AGENTS.md`.)
- **Mobile-first.** Every UI change is designed/tested at 375px width first.
