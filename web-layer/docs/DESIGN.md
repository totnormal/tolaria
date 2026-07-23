# Mobile-First Design Principles (Tolaria Web)

Grounded in Apple HIG (`mobile-ios-design` skill) + responsive-web best practice. Mandatory for all UI work in Phase 4 (and any UI touch earlier). Goal per the owner: **"insanely intuitive, optimised for mobile."** Design at **375px first**, then scale up.

## HIG core principles (apply to the web app)

- **Clarity** — content legible at a glance; generous type, high contrast, precise icons, subtle adornments.
- **Deference** — the UI serves the note content, never competes with it. Chrome recedes; the editor surface dominates.
- **Depth** — visual layers + motion convey hierarchy (sheets over content, focused states, swipe-to-go-back).

## Layout & navigation

- **Single primary action per screen.** The editor is the hero; everything else is a sheet, drawer, or bottom sheet reachable by thumb.
- **Bottom-anchored controls** for thumb reach (≤375px): bottom tab bar (Notes / Search / AI / Git), primary action as a bottom-right FAB ("New note"), command palette as a **bottom sheet** (not a top dropdown).
- **Sidebar → swipeable drawer** on phones (collapse to hamburger / edge-swipe); persist as a column only ≥768px.
- **Safe-area insets**: respect `env(safe-area-inset-*)` (notch / home indicator); never put touch targets under the home indicator.
- **Edge-swipe back** gesture (history back) on phone — feels native.
- **Sticky editor toolbar** that condenses on scroll; expand on selection.

## Typography & theming

- **Fluid type** (`clamp()`) — the web equivalent of Dynamic Type; honor `prefers-reduced-*`.
- **Semantic tokens**, not hardcoded colors: surface / content-primary / content-secondary / accent (HIG `.primary/.secondary/.background` analogue) → automatic light/dark via `prefers-color-scheme`.
- Dark mode first-class (Tolaria is used at night); the inherited login page is already dark zinc.

## Touch & interaction

- **Min 44×44px touch targets** (HIG minimum); 8px+ spacing between targets.
- **Gesture-friendly editor**: swipe-left on a note row → quick actions (pin/delete); long-press → context menu.
- **Instant feedback**: every tap gives immediate visual acknowledgement (<100ms); optimistic saves with rollback on failure.
- **Pull-to-refresh** on the note list (re-fetches vault + git pull).
- **Offline-visible**: a persistent, unobtrusive connectivity/sync indicator (Tolaria is offline-first; the PWA must show sync state).

## Performance = UX

- **LCP < 2.5s, INP < 200ms** on a mid-range phone (3G/4G). Code-split BlockNote / tldraw / mermaid / katex; lazy-load the whiteboard until used.
- **App shell precached** by the service worker so first paint is instant and offline-capable.
- Virtualize long lists (`@tanstack/react-virtual`) — Tolaria vaults run to thousands of notes.

## Accessibility (non-negotiable)

- Full keyboard + screen-reader support (ARIA labels/roles); VoiceOver/TalkBack tested.
- Visible focus rings; contrast AA minimum.
- Respect `prefers-reduced-motion` (HIG motion should be subtle, never gratuitous).

## Tolaria-specific surface map (mobile)

| Surface | Desktop | Mobile (≤375px) |
|---|---|---|
| Note list | Left sidebar | Swipeable drawer / bottom sheet |
| Editor | Center | Full-screen; toolbar condenses on scroll |
| Command palette | Top center (⌘K) | Bottom sheet + thumb keyboard |
| AI panel | Right rail | Full-screen sheet / split swipe-up |
| Git status | Right rail / modal | Collapsed banner → expandable sheet |
| Search | Modal | Full-screen search (recent + results) |

## PWA installability (iOS specifics)

- `display: standalone`, `orientation: portrait` on phones.
- `<link rel="apple-touch-icon" href="/icons/ios-180.png">` (180×180, no transparency — iOS rounds).
- Splash images for all required iPhone sizes; `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`.
- `theme-color` matches the app surface so the iOS status bar blends.
- Open all external links in a new tab (the `opener` plugin shim → `window.open`).

## Sources consulted
- `mobile-ios-design` skill (Apple HIG: Clarity/Deference/Depth, safe areas, Dynamic Type, 44px targets, SF Symbols → icon discipline).
- `web-design-guidelines` skill (responsive/web-app conventions — to be re-read in detail during Phase 4 implementation).
- `web-perf` skill (Core Web Vitals targets) — to be applied in task 4.4.
