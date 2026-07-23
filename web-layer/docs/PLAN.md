# Plan & Tracked Tasks

Phased roadmap. Status legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked. Update this file every session — it is the source of truth for progress.

> Engineering estimate: **~35–45% complete** as of 2026-07-23. Phase 0 protects + documents; Phases 1–5 build outward. Effort: S/M/L.

---

## Phase 0 — Protect & clarify  *(done 2026-07-23)*

- [x] **0.1** Commit Hermes' existing web work (protect from loss) — VPS branch `feat/web-layer` (local backup)
- [x] **0.2** Create this documentation hub (`web-layer/`) — *pushed to origin/main @ `e3c9b281`*
- [x] **0.3** Add `upstream` remote (`refactoringhq/tolaria`)
- [x] **0.4** Lock architecture (alias-shim layer) in `ARCHITECTURE.md`
- [x] **0.5** Enable push: deploy key `tolaria_app_ed25519` added to `totnormal/tolaria`; docs pushed. **Develop + push from the local Mac** (`~/Documents/Playground/tolaria`, gh authed, pnpm 10.33) — VPS pnpm 11 breaks the husky deps-check, so the VPS is a **deploy target only**.
- [x] **0.6** Backup: VPS `feat/web-layer` branch retains the raw Hermes prototype; origin/main carries the docs.

> **Development workflow (locked):** the upstream `.husky/pre-push` forces **`main → main` only** and runs the full gauntlet (codacy → eslint → tsc+vite build → vitest coverage ≥70% → playwright smoke; Rust skips when `src-tauri/` untouched). Therefore our layer lives on the **fork's `main`**, developed locally, pushed only when gauntlet-green. Docs-only pushes auto-skip app checks. See `PHASE-1-SEED.md`.

## Phase 1 — Refactor into a clean additive layer  *(in progress — seed spec written)*

- [ ] **1.1** Create `packages/web` workspace package with its own `vite.config.ts` + `tsconfig.json` + `index.html`
- [ ] **1.2** Write `tauriShim.ts` (`invoke` → `webTransport`) + plugin stubs; prove the alias intercepts `@tauri-apps/api/core`
- [ ] **1.3** Move `webTransport.ts`, `LoginPage.tsx` from `src/*` into `packages/web/src/*`; write `main-web.tsx` + `AuthGate.tsx`
- [ ] **1.4** Revert the upstream-file edits (`src/App.tsx`, `src/main.tsx`, `src/mock-tauri/index.ts`, `vite.config.ts`, `src/hooks/useGlobalQuickLauncher.ts`) — restore them to upstream state so merges are clean
- [ ] **1.5** `pnpm build` from `packages/web` produces a working `dist/` (no `@react-refresh`, minified)
- [ ] **1.6** Remove the duplicated `vaultApiPlugin` from root `vite.config.ts`; server is the single source of truth
- [ ] **1.7** Path-containment guard (`packages/server/src/security.ts`) on **every** vault/git handler; reject `..`/absolute
- [ ] **1.8** Set real secrets (gitignored `web-layer/deploy/.env`): `TOLARIA_JWT_SECRET`, `TOLARIA_ADMIN_PASSWORD`; rotate `users.json`
- [ ] **1.9** First server tests (vitest): auth flow + path-guard rejection cases

## Phase 2 — Core remote functionality

- [ ] **2.1** Replace junk seed vault with a clone of `totnormal/tolaria-vault` at `TOLARIA_VAULT_PATH`; verify the real notes list
- [ ] **2.2** End-to-end git sync: commit/pull/push against the vault remote via deploy key; auto-commit on save (debounced)
- [ ] **2.3** **AI bridge**: `packages/server/src/ai/bridge.ts` → headless `pi`, streaming tokens over WS; wire the frontend AI panel + model picker
- [ ] **2.4** Harden auth: HttpOnly+SameSite cookie, refresh tokens, `express-rate-limit`, strict CSP, lock CORS to origin
- [ ] **2.5** Conciliate the desktop↔web concurrent-edit policy (last-writer-wins + conflict UI)

## Phase 3 — Production deployment

- [ ] **3.1** **Fix the 526**: add `tolaria.tarnovski.com → http://127.0.0.1:80` to `/root/.cloudflared/config.yml`; restart cloudflared; verify `https://` → 200
- [ ] **3.2** `tolaria-web.service` systemd unit (build from `dist/`, `Restart=always`, `EnvironmentFile`); stop the Hermes-spawned dev processes
- [ ] **3.3** Bind app ports to `127.0.0.1` only; confirm no public `:5202/:3200`; optional Cloudflare Access in front
- [ ] **3.4** Observability: structured logs (`pino`), deep `/api/health`, log rotation, alert on restart loop
- [ ] **3.5** Deploy pipeline: `.github/workflows/deploy-web.yml` (build → ssh → restart)

## Phase 4 — PWA + mobile UX

- [ ] **4.1** `vite-plugin-pwa`: manifest, maskable icons (192/512), `apple-touch-icon`, splash, `display:standalone`, portrait orientation
- [ ] **4.2** Service worker: precache shell, runtime-cache reads, **background-sync** offline write queue
- [ ] **4.3** **Mobile UX pass** (insanely intuitive): thumb-reach layout, gesture editor, bottom-sheet command palette, 375px-first; consult design skills; Lighthouse PWA + a11y ≥ 90
- [ ] **4.4** Performance: code-split BlockNote/tldraw/mermaid; lazy-load; LCP < 2.5s on mobile

## Phase 5 — iOS via Capacitor

- [ ] **5.1** `npx cap init`, `webDir = packages/web/dist`, `cap add ios`
- [ ] **5.2** Native modules: biometric lock, push (optional), share sheet
- [ ] **5.3** Build & run on simulator, then device; TestFlight for personal distribution
- [ ] **5.4** (Optional spike) Evaluate Tauri Mobile as the alternative if Capacitor limits us

---

## Dependency notes
- 0.5 (push) is nice-to-have for 1.x but not blocking — commits are local-protected.
- 1.1–1.5 before 1.6–1.9. 1.4 (revert upstream edits) only after 1.5 proves the alias build works.
- 1.7/1.8 before 3.1 (don't expose with weak security).
- Phase 4 requires Phase 1 build. 5.1 requires 4.1 (manifest).
