/** Stub for @tauri-apps/plugin-updater — no-ops in browser. */

export async function checkUpdate(): Promise<{ available: boolean; version?: string }> {
  return { available: false }
}

export async function installUpdate(): Promise<void> {
  // no-op
}
