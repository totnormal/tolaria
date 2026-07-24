/** Stub for @tauri-apps/plugin-dialog — no-ops in browser. */

export async function open(options?: Record<string, unknown>): Promise<null> {
  void options
  return null
}

export async function save(options?: Record<string, unknown>): Promise<null> {
  void options
  return null
}

export async function message(msg: string, options?: Record<string, unknown>): Promise<void> {
  void msg; void options
}

export async function ask(msg: string, options?: Record<string, unknown>): Promise<boolean> {
  void msg; void options
  return false
}

export async function confirm(msg: string, options?: Record<string, unknown>): Promise<boolean> {
  void msg; void options
  return false
}
