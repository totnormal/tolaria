/** Stub for @tauri-apps/plugin-global-shortcut — no-ops in browser. */

export async function register(
  shortcut: string | string[],
  handler?: (event: unknown) => void,
): Promise<void> {
  void shortcut; void handler // no-op: global shortcuts are desktop-only
}

export async function unregister(shortcut: string | string[]): Promise<void> {
  void shortcut // no-op
}

export async function unregisterAll(): Promise<void> {
  // no-op
}
