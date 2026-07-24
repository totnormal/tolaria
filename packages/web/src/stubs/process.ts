/** Stub for @tauri-apps/plugin-process — no-ops in browser. */

export async function exit(code?: number): Promise<void> {
  void code // no-op: can't exit from browser
}

export async function relaunch(): Promise<void> {
  window.location.reload()
}

export async function pid(): Promise<number> {
  return 0
}
