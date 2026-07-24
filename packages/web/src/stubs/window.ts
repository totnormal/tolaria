/** Stub for @tauri-apps/api/window in web builds. */

export interface WebWindow {
  isFullscreen(): Promise<boolean>
  onResized(handler: () => void): Promise<() => void>
  close(): Promise<void>
  show(): Promise<void>
  hide(): Promise<void>
  setTitle(title: string): Promise<void>
  setFullscreen(fullscreen: boolean): Promise<void>
}

const noopWindow: WebWindow = {
  isFullscreen: async () => false,
  onResized: async () => () => {},
  close: async () => {},
  show: async () => {},
  hide: async () => {},
  setTitle: async () => {},
  setFullscreen: async () => {},
}

export function getCurrentWindow(): WebWindow {
  return noopWindow
}
