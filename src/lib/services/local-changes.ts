/**
 * A signal that this device changed something worth sending to Drive.
 *
 * Automatic syncing needs to know when to run, and asking "has anything
 * changed?" on a timer means either asking too often or noticing too late.
 *
 * Deliberately free of any import: `db.ts` raises the signal for the tables a
 * snapshot is made of, and `setting-sync.ts` raises it for the settings that
 * live in local storage instead. Depending on either from here would drag
 * Dexie into modules -- and into unit tests -- that have no use for it.
 */

type Listener = () => void

const listeners = new Set<Listener>()

/**
 * How many callers are currently writing rows that came *from* Drive.
 *
 * A pull writes the merged snapshot into the same tables an edit would, and
 * without this the write would look like a local change and schedule a push of
 * what was just pulled -- forever.
 */
let suppressions = 0

export function notifyLocalChange(): void {
  if (suppressions > 0 || listeners.size === 0) {
    return
  }
  // Out of the caller's own call stack: this is raised from inside a Dexie
  // hook, and a listener that touched the database from there would be
  // re-entering the transaction it was called by.
  queueMicrotask(() => {
    for (const listener of [...listeners]) {
      listener()
    }
  })
}

export function subscribeToLocalChanges(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Runs `write` without any of it counting as something this device did. */
export async function asRemoteWrite<T>(write: () => Promise<T>): Promise<T> {
  suppressions += 1
  try {
    return await write()
  } finally {
    suppressions -= 1
  }
}
