import { useEffect } from 'react'
import { commands } from '@/lib/commands'
import { subscribeToLocalChanges } from '@/lib/services/local-changes'
import { endSync, tryBeginSync } from '@/lib/services/sync-activity'
import {
  AUTO_SYNC_IDLE_MS,
  AUTO_SYNC_MAX_WAIT_MS,
  AUTO_SYNC_POLL_MS,
  AUTO_SYNC_STALE_MS,
  createDebouncer,
  isStale,
} from '@/lib/sync/auto-sync-policy'

/**
 * Syncs with Drive without being asked to: on opening the app, a while after
 * an edit, on coming back to the tab, and when another device has written.
 *
 * Everything here is silent. A background sync that cannot get a token, or
 * that Drive refuses, says nothing and changes nothing -- the button on the
 * settings screen is the one that reports, because it is the one someone is
 * waiting on. A toast for a sync nobody started would interrupt whatever they
 * were actually doing, which in a headset is worse than in a tab.
 *
 * A device that has never connected to Drive still runs all of this; every
 * attempt stops at "no token" after one read of the local database, which is
 * cheaper than working out whether to have started.
 */
export function useDriveAutoSync(): void {
  useEffect(() => {
    let stopped = false
    let lastSyncedAt: number | null = null

    const sync = async () => {
      if (stopped || !tryBeginSync()) {
        return
      }
      let syncedAt: number | null = null
      try {
        const result = await commands.syncGoogleDriveInBackground()
        if (result.status === 'ok' && result.data.kind === 'synced') {
          syncedAt = result.data.syncedAt
          lastSyncedAt = syncedAt
        }
      } finally {
        endSync(syncedAt)
      }
    }

    const debouncer = createDebouncer({
      idleMs: AUTO_SYNC_IDLE_MS,
      maxWaitMs: AUTO_SYNC_MAX_WAIT_MS,
      flush: () => {
        void sync()
      },
    })

    // Opening the app is the one moment both devices are guaranteed to reach,
    // so it is where a change made elsewhere actually arrives.
    void sync()

    const unsubscribe = subscribeToLocalChanges(() => {
      debouncer.note()
    })

    const onVisible = () => {
      if (document.visibilityState !== 'visible') {
        // Leaving with edits still waiting is how a tab closed mid-thought
        // loses them; send them now rather than on a timer that may not run.
        debouncer.flush()
        return
      }
      if (isStale(lastSyncedAt, Date.now(), AUTO_SYNC_STALE_MS)) {
        void sync()
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    // Drive can push changes to a webhook, which a static site has nowhere to
    // receive, so the only way to notice another device is to ask. The poll
    // itself reads one field; a sync only follows if that field moved.
    const poll = setInterval(() => {
      if (document.visibilityState !== 'visible') {
        return
      }
      void commands.googleDriveRemoteChanged().then((result) => {
        if (result.status === 'ok' && result.data) {
          void sync()
        }
      })
    }, AUTO_SYNC_POLL_MS)

    return () => {
      stopped = true
      clearInterval(poll)
      document.removeEventListener('visibilitychange', onVisible)
      unsubscribe()
      debouncer.cancel()
    }
  }, [])
}
