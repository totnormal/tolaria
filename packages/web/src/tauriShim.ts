/**
 * Tauri shim — intercepts `import { invoke } from '@tauri-apps/api/core'`
 * and delegates to webTransport.webInvoke in browser mode.
 *
 * Vite resolve.alias maps '@tauri-apps/api/core' → this file.
 */

import { webInvoke } from './webTransport'

/**
 * Drop-in replacement for Tauri's invoke().
 * Routes commands to the Express server REST API.
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  return webInvoke<T>(cmd, args)
}

/**
 * Stub for Tauri's Channel class — used for streaming data from Rust to JS.
 * In web mode, provides a minimal implementation.
 */
export class Channel<T> {
  #id: string
  #onmessage?: (data: T) => void

  constructor() {
    this.#id = `channel_${crypto.randomUUID().slice(0, 8)}`
  }

  set onmessage(handler: ((data: T) => void) | undefined) {
    this.#onmessage = handler
  }

  get onmessage() {
    return this.#onmessage
  }

  toJSON() {
    return { __TAURI_CHANNEL_MARKER__: true, id: this.#id }
  }
}

/**
 * Stub for Tauri's convertFileSrc — converts a file path to a URL.
 * In browser mode, returns the path as-is (no file:// protocol available).
 */
export function convertFileSrc(filePath: string, protocol = 'asset'): string {
  void protocol
  return filePath
}

// Re-export webTransport utilities for convenience
export {
  login,
  logout,
  setAuthToken,
  getAuthToken,
  isWebAvailable,
} from './webTransport'
