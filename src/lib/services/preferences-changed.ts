/**
 * A signal that the stored preferences were replaced by something other than
 * the screen that shows them -- a sync taking in another device's settings, or
 * a backup being restored.
 *
 * Nothing in this app watches local storage, and a `storage` event only fires
 * in *other* tabs, so a pulled theme or language sat on disk unread until the
 * next reload: the sync had worked and the app looked exactly as if it had not.
 * This is the same shape of problem `refresh-views.ts` solves for Dexie, and
 * the same shape of answer.
 *
 * Deliberately free of any import, for the reason `local-changes.ts` is: it is
 * raised in the service layer and listened to by components, and a dependency
 * either way would tie the two together.
 */

type Listener = () => void

const listeners = new Set<Listener>()

export function notifyPreferencesChanged(): void {
  if (listeners.size === 0) {
    return
  }
  // Out of the caller's own call stack: this is raised at the end of a write,
  // and a listener that read the same storage from there would be reading it
  // while the writer is still part-way through its own work.
  queueMicrotask(() => {
    for (const listener of [...listeners]) {
      listener()
    }
  })
}

export function subscribeToPreferencesChanged(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
