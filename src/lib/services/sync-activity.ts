import type { SyncStep } from './drive-sync-service'

/**
 * One place that knows whether a sync is running, so two of them cannot start
 * at once and the settings screen can say so.
 *
 * There are two buttons that start one -- on the list and on the settings
 * screen -- and a press on one while the other is still running must not
 * become a second sync. Two syncs racing would each merge against a file the
 * other is about to replace, which the optimistic retry would survive but only
 * by doing all the work twice.
 *
 * It is also what the "please wait" dialog reads (#221). A sync writes back
 * what it read at the start, so anything changed on this device while it runs
 * is overwritten with the older copy; the dialog keeps the app out of reach
 * until it is over, and offers the one thing that ends it early.
 */

export interface SyncActivity {
  running: boolean
  /** When the last sync finished, or `null` if none has in this browser. */
  lastSyncedAt: number | null
  /** How far the running sync has got, or `null` before it reports. */
  step: SyncStep | null
  /** Stop has been pressed and the sync has not wound down yet. */
  aborting: boolean
}

/**
 * Thrown into a sync that was stopped on purpose. It is the reason its
 * `AbortSignal` carries, so a request cut short by it can be told apart from
 * one that failed.
 */
export class SyncAbortedError extends Error {}

let activity: SyncActivity = {
  running: false,
  lastSyncedAt: null,
  step: null,
  aborting: false,
}
let controller: AbortController | null = null
let fetchesRunning = 0

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

/**
 * What asking to sync came to. A sync already running is refused silently, as
 * the button that started it is already saying so; one refused because
 * VRChat's favourites are still being written is worth a sentence.
 */
export type SyncClaim =
  | { kind: 'started'; signal: AbortSignal }
  | { kind: 'refused'; because: 'syncing' | 'fetching' }

/** Claims the right to sync, or reports why someone else already has it. */
export function tryBeginSync(): SyncClaim {
  if (activity.running) {
    return { kind: 'refused', because: 'syncing' }
  }
  // The dialog shuts out what is pressed from now on, but a fetch already
  // under way writes whenever its answers arrive -- right through the window
  // in which the sync's write-back would undo it.
  if (fetchesRunning > 0) {
    return { kind: 'refused', because: 'fetching' }
  }
  controller = new AbortController()
  publish({ ...activity, running: true, step: null, aborting: false })
  return { kind: 'started', signal: controller.signal }
}

export function reportSyncStep(step: SyncStep): void {
  if (activity.running) {
    publish({ ...activity, step })
  }
}

/**
 * Whether stopping would still leave this device as it was.
 *
 * Everything before `applying` only reads this device and talks to Drive, so
 * stopping there leaves the data untouched; a merge already written to Drive
 * is merged again by the next sync, which is all a sync ever does. `applying`
 * is one local transaction and over in a moment, and stopping it half way is
 * the one thing that could leave the device half written.
 */
export function canAbortSync(current: SyncActivity = activity): boolean {
  return current.running && !current.aborting && current.step !== 'applying'
}

export function abortSync(): void {
  if (!canAbortSync() || controller === null) {
    return
  }
  publish({ ...activity, aborting: true })
  controller.abort(new SyncAbortedError('The sync was stopped'))
}

/** Gives it back. `syncedAt` is `null` when the attempt did not get that far. */
export function endSync(syncedAt: number | null): void {
  controller = null
  publish({
    running: false,
    lastSyncedAt: syncedAt ?? activity.lastSyncedAt,
    step: null,
    aborting: false,
  })
}

/**
 * Keeps a sync from starting while `work` -- a fetch from VRChat that writes
 * what it reads -- is still under way.
 */
export async function withoutSyncing<T>(work: () => Promise<T>): Promise<T> {
  fetchesRunning++
  try {
    return await work()
  } finally {
    fetchesRunning--
  }
}

export function subscribeToSyncActivity(
  listener: (activity: SyncActivity) => void,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
