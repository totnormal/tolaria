# Tolaria Web Layer

This folder is **our** additive layer on top of upstream [Tolaria](https://github.com/refactoringhq/tolaria) (the open-source desktop note app by `lucaronin` / `refactoringhq`). It holds everything required to run Tolaria as a **mobile-first, installable PWA** (and, immediately after, an **iOS app**) served from the Hetzner VPS — **without forking upstream in a way that blocks updates.**

> **Golden rule:** our code is a *layer*, not a fork-with-edits. We add files; we do not edit upstream files. When `refactoringhq/tolaria` publishes an update, `git merge upstream/main` must apply cleanly.

## What lives where

| Path | Purpose | Upstream? |
|---|---|---|
| `packages/server/` | Express REST API replacing Tauri IPC (vault + git + auth) | **Ours** (additive) |
| `packages/web/` *(Phase 1)* | Web shell: web entry, Tauri-API shim, auth gate, login | **Ours** (additive) |
| `web-layer/` (this folder) | Docs, deploy configs, planning | **Ours** (additive) |
| `src/`, `src-tauri/`, `docs/`, `site/`, … | The Tolaria app itself | **Upstream** — do not edit |

## Docs index

- [`docs/ASSESSMENT.md`](docs/ASSESSMENT.md) — technical audit of the state inherited from Hermes Agent (as of 2026-07-23).
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — the layer design: how we stay merge-clean, single-user, git-sync, AI bridge via Pi, PWA, iOS.
- [`docs/PLAN.md`](docs/PLAN.md) — phased roadmap **with a tracked task checklist**.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — locked product/architecture decisions and policies.

## Current status (snapshot)

- **Live but unreachable publicly.** App runs on the VPS (backend `:3200`, Vite dev `:5202`, nginx `tolaria.tarnovski.com`), but `https://tolaria.tarnovski.com` → **Cloudflare 526** (tunnel has no ingress for it; origin has no TLS).
- **Insecure defaults in effect** (password `tolaria`, random JWT secret) until secrets are set.
- **All web work was uncommitted** — committed to `feat/web-layer` on 2026-07-23 (see git log).
- Overall completion: **~35–45%**. See `docs/PLAN.md`.

## How to update from upstream

```bash
T=/root/.hermes/hermes-agent/root/workspace/tolaria/tolaria
cd "$T"
git fetch upstream                         # upstream = https://github.com/refactoringhq/tolaria.git
git checkout main && git merge upstream/main   # keep main = upstream + our merge commits
git checkout feat/web-layer && git merge main  # fold upstream into our layer branch
# resolve conflicts only if an additive file collided (should be rare/never)
pnpm install && pnpm build && pnpm test
```

Because every file we own is **additive** (new path, or a Vite alias — never an edit to `src/*`), upstream merges are effectively conflict-free. The one upstream file we may touch is `vite.config.ts`; we minimize that by doing all web wiring in `packages/web/vite.config.ts` instead.

## Push access (action needed)

The VPS can **read** `totnormal/tolaria` but not **push** (the `github_tolaria` deploy key is scoped to `tolaria-vault`, the vault repo). To enable `git push` from the VPS, do **one** of:
1. Add `/root/.ssh/github_tolaria.pub` (or a new key) as a **deploy key** on `github.com/totnormal/tolaria` (Settings → Deploy keys, allow write), **or**
2. Provide a GitHub PAT (scope `repo`) to store in a gitignored `web-layer/deploy/.env`.

Until then, commits stay local on the VPS (protected) and push when auth is in place.
