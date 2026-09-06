/**
 * One place that knows whether a sync is running, so two of them cannot start
 * at once and the settings screen can say so.
 *
 * Automatic syncing means the button is no longer the only thing that starts
 * one: an edit, coming back to the tab, and a poll can all fire while someone
 * is looking at the screen. Two syncs racing would each merge against a file
 * the other is about to replace, which the optimistic retry would survive but
 * only by doing all the work twice.
 */

export interface SyncActivity {
  running: boolean
  /** When the last sync finished, or `null` if none has in this browser. */
  lastSyncedAt: number | null
}

let activity: SyncActivity = { running: false, lastSyncedAt: null }

const listeners = new Set<(activity: SyncActivity) => void>()

function publish(next: SyncActivity): void {
  activity = next
  for (const listener of [...listeners]) {
    listener(activity)
  }
}

export function syncActivity(): SyncActivity {
  return activity
}

/** Claims the right to sync, or reports that someone else already has it. */
export function tryBeginSync(): boolean {
  if (activity.running) {
    return false
  }
  publish({ ...activity, running: true })
  return true
}

/** Gives it back. `syncedAt` is `null` when the attempt did not get that far. */
export function endSync(syncedAt: number | null): void {
  publish({
    running: false,
    lastSyncedAt: syncedAt ?? activity.lastSyncedAt,
  })
}

export function subscribeToSyncActivity(
  listener: (activity: SyncActivity) => void,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
