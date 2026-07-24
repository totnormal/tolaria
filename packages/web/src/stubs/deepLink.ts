/** Stub for @tauri-apps/plugin-deep-link — no-ops in browser. */

export async function onOpenUrl(handler: (urls: string[]) => void): Promise<() => void> {
  void handler
  return () => {}
}

export async function getCurrent(): Promise<string[]> {
  return []
}
