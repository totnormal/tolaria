/** Minimal browser-compatible event system stub for @tauri-apps/api/event. */

type EventCallback<T> = (event: { payload: T }) => void

const listeners = new Map<string, Set<EventCallback<unknown>>>()

export async function listen<T>(
  event: string,
  handler: EventCallback<T>,
): Promise<() => void> {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event)!.add(handler as EventCallback<unknown>)

  return () => {
    listeners.get(event)?.delete(handler as EventCallback<unknown>)
  }
}

export async function emit(event: string, payload?: unknown): Promise<void> {
  const handlers = listeners.get(event)
  if (!handlers) return
  for (const handler of handlers) {
    handler({ payload })
  }
}

export async function emitTo(
  _target: string,
  event: string,
  payload?: unknown,
): Promise<void> {
  return emit(event, payload)
}
