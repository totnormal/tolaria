/** Stub for @tauri-apps/plugin-opener — delegates to window.open. */

export function openUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer')
}

export function openPath(path: string): void {
  void path // no-op: file system access not available in browser
}
