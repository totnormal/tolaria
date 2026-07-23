# Phase 1 Seed Spec — Clean Additive Layer

Immutable contract for the Phase 1 implementation session. Produced via `spec-first-planning`. Do not edit mid-implementation; if intent changes, write a delta.

## Ambiguity gate (brownfield)

```yaml
ambiguity_gate:
  goal_clarity: 0.95      # refactor inherited edits into an additive alias-shim layer; produce a gauntlet-green build
  constraint_clarity: 0.90 # pnpm 10, main-only, husky gauntlet must pass, ZERO edits to src/*, single-user
  success_criteria: 0.90  # alias intercepts invoke; pnpm build green; upstream files reverted to b6d6bc75; path-guard + tests; secrets staged
  context_clarity: 0.90   # full audit done 2026-07-23; 142 invoke sites; plugin set enumerated
  weighted_clarity: 0.9175
  ambiguity: 0.0825       # ≤ 0.20
  gate: pass
  open_questions: []      # none blocking
```

## Goal
Turn the inherited Hermes web work into a **clean additive layer** so the app builds as a production web bundle and upstream `refactoringhq/tolaria` merges stay conflict-free — while fixing the critical security defaults.

## Constraints (invariants that must not break)
- **Layer, not fork:** zero edits to `src/*`. All web code additive under `packages/web` (+ existing `packages/server`). The ONLY upstream files touched: `pnpm-workspace.yaml` (register packages) — minimize and document.
- **Build via alias:** `packages/web/vite.config.ts` uses `resolve.alias` to map `@tauri-apps/api/core` → `packages/web/src/tauriShim.ts`, and each `@tauri-apps/plugin-*` → a stub. Upstream `invoke()` callers (142 files) untouched.
- **Gauntlet-green:** every push from local Mac passes husky pre-push (codacy → eslint → `tsc -b && vite build` → vitest coverage ≥70% → playwright smoke). Rust checks auto-skip (no `src-tauri/` changes).
- **Single-user:** one account; still enforce path containment.
- **TDD:** no production code without a failing test first (`test-driven-development` skill, Iron Law).

## Acceptance criteria (each independently checkable)
1. `packages/web` is a pnpm workspace package with `vite.config.ts`, `tsconfig.json`, `index.html`.
2. `packages/web/src/tauriShim.ts` exports `invoke(cmd, args)` that delegates to `webTransport.webInvoke`; a unit test proves the routing for ≥3 representative commands (list_vault, save_note_content, git_commit).
3. The alias is proven: a web build resolves `@tauri-apps/api/core` to the shim (verified by a build artifact or a vitest alias-resolution test).
4. `src/App.tsx`, `src/main.tsx`, `src/mock-tauri/index.ts`, `src/hooks/useGlobalQuickLauncher.ts`, `vite.config.ts` are **byte-identical to upstream `b6d6bc75`** (`git diff b6d6bc75 -- <file>` empty).
5. `pnpm build` (root) succeeds; `pnpm --filter @tolaria/web build` produces `packages/web/dist/index.html` (no `@react-refresh`).
6. Path-containment guard `packages/server/src/security.ts` added; unit tests prove `..`, absolute paths, and symlink escapes are rejected; applied to every vault/git handler.
7. Real secrets staged in `web-layer/deploy/.env` (gitignored) + `.env.example`; `users.json` rotated.
8. First server tests under `packages/server/src/**/*.test.ts` (vitest) cover auth + path-guard.
9. husky pre-push passes locally for the Phase 1 commit set.

## Out of scope (Phase 2+)
- Real-vault clone/sync, AI bridge (Pi), cookie auth, Capacitor/iOS, PWA service worker, public deployment (526 fix), systemd.

## Files to create / touch
- **Create:** `packages/web/{package.json,tsconfig.json,vite.config.ts,index.html}`, `packages/web/src/{main-web.tsx,tauriShim.ts,webTransport.ts,AuthGate.tsx,LoginPage.tsx,stubs/*.ts}`, `packages/web/src/**/*.test.ts`, `packages/server/src/security.ts`, `packages/server/src/**/*.test.ts`, `web-layer/deploy/{.env.example,.env(ignored),nginx.conf,tolaria-web.service,cloudflared-ingress.yml}`.
- **Move (out of upstream src/):** `src/lib/webTransport.ts`, `src/components/LoginPage.tsx` → `packages/web/src/`.
- **Revert to upstream:** `src/App.tsx`, `src/main.tsx`, `src/mock-tauri/index.ts`, `src/hooks/useGlobalQuickLauncher.ts`, `vite.config.ts`.
- **Edit (minimal, documented):** `pnpm-workspace.yaml` (add `packages/*`).

## Implementation order (TDD per slice)
1. Register workspace packages; `pnpm install`.
2. TDD `packages/server/src/security.ts` (path guard) + tests. ← first slice, lowest risk, fixes Critical finding
3. Move `webTransport.ts` into `packages/web`; TDD its command routing.
4. TDD `tauriShim.ts` (invoke → webTransport).
5. Scaffold `packages/web` vite config + alias + stubs; prove alias resolution (build/test).
6. Write `main-web.tsx` + `AuthGate.tsx` (move LoginPage); revert upstream src edits.
7. `pnpm build` green; commit; push (gauntlet).

## Verification (3-stage)
- **Mechanical:** `pnpm --filter @tolaria/web build`, `pnpm --filter @tolaria/server test`, root `pnpm build`, `git diff b6d6bc75 -- src/` empty, husky pre-push green.
- **Semantic:** cross-model review of the alias shim + path-guard against this rubric (entwurf, different model family).
- **Consensus:** not required (not security-prod-critical beyond the path guard, which is unit-tested).
