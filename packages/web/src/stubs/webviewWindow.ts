/** Stub for @tauri-apps/api/webviewWindow — opens a browser window instead. */

export class WebviewWindow {
  label: string

  constructor(label: string, options?: Record<string, unknown>) {
    this.label = label
    void options
  }

  async isFullscreen(): Promise<boolean> { return false }
  async setFullscreen(v: boolean): Promise<void> { void v }
  async close(): Promise<void> {}
  async show(): Promise<void> {}
  async hide(): Promise<void> {}
  async setTitle(title: string): Promise<void> { document.title = title }
  async onResized(handler: () => void): Promise<() => void> {
    void handler
    return () => {}
  }

  static async getAll(): Promise<WebviewWindow[]> { return [] }
  static async getByLabel(label: string): Promise<WebviewWindow | null> {
    return new WebviewWindow(label)
  }
}
