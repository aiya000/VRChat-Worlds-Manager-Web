import { subscribeToLocalChanges } from './local-changes'

/**
 * Remembers when this device last changed something, so the sync button can
 * show that a press is due.
 *
 * Kept in local storage rather than in memory: a reload is exactly the moment
 * the memory would be lost, and the change it recorded is still here waiting.
 */
const LOCAL_CHANGED_AT_KEY = 'driveLocalChangedAt'

type Listener = (at: number) => void

const listeners = new Set<Listener>()

export function lastLocalChangeAt(): number | null {
  if (typeof window === 'undefined') {
    return null
  }
  const raw = localStorage.getItem(LOCAL_CHANGED_AT_KEY)
  if (raw === null) {
    return null
  }
  const at = Number(raw)
  return Number.isFinite(at) ? at : null
}

export function recordLocalChange(at: number = Date.now()): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(LOCAL_CHANGED_AT_KEY, String(at))
  for (const listener of [...listeners]) {
    listener(at)
  }
}

export function subscribeToUnsyncedChanges(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Turns the change signal into a recorded moment, for as long as the caller
 * keeps the subscription. Mounted once by the list view shell: the signal only
 * reaches listeners that exist, and a change made on the settings screen has
 * to count too.
 */
export function startTrackingLocalChanges(): () => void {
  return subscribeToLocalChanges(() => {
    recordLocalChange()
  })
}
