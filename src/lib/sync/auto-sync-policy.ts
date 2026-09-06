/**
 * When a sync nobody asked for is allowed to happen.
 *
 * Nothing here knows about Drive, Dexie or the DOM, so the awkward part -- a
 * burst of edits that must not turn into a burst of uploads -- can be tested
 * against a fake clock rather than against a real minute.
 */

/** How long the edits have to stop before what they changed is sent up. */
export const AUTO_SYNC_IDLE_MS = 10_000

/**
 * ...and how long a stream of edits that never stops may hold that off.
 *
 * Without it, dragging worlds between folders for two minutes would postpone
 * the upload for two minutes, and a tab closed at the end of that loses all
 * of it.
 */
export const AUTO_SYNC_MAX_WAIT_MS = 60_000

/**
 * How out of date the last sync has to be for coming back to the tab to redo
 * it. Short enough that picking the phone up after a session at the desk shows
 * what was done there; long enough that flicking between two tabs does not
 * sync on every flick.
 */
export const AUTO_SYNC_STALE_MS = 120_000

/**
 * How often to ask Drive whether another device has written.
 *
 * A whole file read would be wasteful at this rate; the poll only fetches the
 * file's `version`. Drive's push notifications (`changes.watch`) would be
 * cheaper still, but they need a webhook to deliver to, and this app is a
 * static site with nowhere to receive one.
 */
export const AUTO_SYNC_POLL_MS = 60_000

export interface Debouncer {
  /** Records that something changed just now. */
  note: () => void
  /** Sends what is waiting, if anything is. */
  flush: () => void
  cancel: () => void
  pending: () => boolean
}

/**
 * Collects changes and calls `flush` once they settle -- or once
 * `maxWaitMs` has passed since the first of them, whichever comes first.
 */
export function createDebouncer(options: {
  idleMs: number
  maxWaitMs: number
  flush: () => void
}): Debouncer {
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let maxTimer: ReturnType<typeof setTimeout> | null = null

  const clearTimers = () => {
    if (idleTimer !== null) {
      clearTimeout(idleTimer)
      idleTimer = null
    }
    if (maxTimer !== null) {
      clearTimeout(maxTimer)
      maxTimer = null
    }
  }

  const fire = () => {
    clearTimers()
    options.flush()
  }

  return {
    note: () => {
      if (idleTimer !== null) {
        clearTimeout(idleTimer)
      }
      idleTimer = setTimeout(fire, options.idleMs)
      // Started by the first change of a run and left alone by the rest, so
      // the ceiling is measured from when the run began.
      if (maxTimer === null) {
        maxTimer = setTimeout(fire, options.maxWaitMs)
      }
    },
    flush: () => {
      if (idleTimer !== null) {
        fire()
      }
    },
    cancel: clearTimers,
    pending: () => idleTimer !== null,
  }
}

/** Whether the last sync is old enough to be worth repeating. */
export function isStale(
  lastSyncedAt: number | null,
  now: number,
  staleAfterMs: number,
): boolean {
  if (lastSyncedAt === null) {
    return true
  }
  return now - lastSyncedAt >= staleAfterMs
}
