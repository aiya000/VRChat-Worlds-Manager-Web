import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useLocalization } from '@/hooks/use-localization'
import { commands } from '@/lib/commands'
import { subscribeToLocalChanges } from '@/lib/services/local-changes'
import { refreshViews } from '@/lib/services/refresh-views'
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
 * What set a sync going. It decides whether the sync is allowed to say
 * anything: a sync nobody started should not interrupt what someone is doing,
 * so only the two cases they would want to act on speak up.
 */
type SyncTrigger = 'startup' | 'local-change' | 'visible' | 'remote-change'

/**
 * Syncs with Drive without being asked to: a while after an edit, on coming
 * back to the tab, and when another device has written.
 *
 * **None of it can open Google's window.** Every trigger here runs on the
 * token a press already obtained and stops quietly when there is none -- see
 * `getAccessTokenIfHeld` for what happened when one of them was allowed to
 * ask. The practical shape is: press "sync now" once, and the rest of that
 * hour looks after itself; reload, and the first sync is a press again.
 *
 * The startup attempt is kept because it costs nothing -- it succeeds only in
 * the rare case where a token is already in hand, and is otherwise a no-op --
 * and because it is the one place a token obtained on the settings screen gets
 * used before anything else happens.
 */
export function useDriveAutoSync(): void {
  const { t } = useLocalization()

  // `useLocalization` builds a new `t` on every render, so depending on it
  // would tear this effect down and set another startup sync going each time
  // anything above re-rendered. The effect runs once and reads the current
  // one through here.
  const translate = useRef(t)
  useEffect(() => {
    translate.current = t
  })

  useEffect(() => {
    let stopped = false
    let lastSyncedAt: number | null = null
    /**
     * Whether the user has already been told the hour ran out. Without it the
     * poll would say so once a minute for as long as the tab stays open.
     */
    let warnedAboutReauth = false

    const askToSyncByHand = () => {
      // Reached from inside a click, which is the whole point: Google only
      // grants a token within a user gesture, and this toast exists to
      // provide one.
      void commands.syncGoogleDriveNow()
    }

    const reportExpiredToken = async () => {
      if (warnedAboutReauth) {
        return
      }
      // Not connected is not an expiry -- it is the ordinary state of a device
      // that never opted in, and it must not be reported as a problem.
      const connected = await commands.isGoogleDriveConnected()
      if (connected.status !== 'ok' || !connected.data) {
        return
      }
      warnedAboutReauth = true
      toast(translate.current('settings-page:google-drive-reauth-needed'), {
        action: {
          label: translate.current('settings-page:google-drive-sync-now'),
          onClick: askToSyncByHand,
        },
      })
    }

    const sync = async (trigger: SyncTrigger) => {
      if (stopped || !tryBeginSync()) {
        return
      }
      let syncedAt: number | null = null
      try {
        const result = await commands.syncGoogleDriveInBackground()
        if (result.status !== 'ok') {
          return
        }

        if (result.data.kind === 'reauth-needed') {
          // Only when an edit was waiting to go up: that is the moment the
          // expiry costs something, and the one #106 asks to surface. On a
          // startup or a poll there is nothing of theirs left unsaved.
          if (trigger === 'local-change') {
            await reportExpiredToken()
          }
          return
        }
        if (result.data.kind !== 'synced') {
          return
        }

        syncedAt = result.data.syncedAt
        lastSyncedAt = syncedAt
        warnedAboutReauth = false

        // Not after the device's own edit: the screen already shows it, and
        // re-reading every list under someone who is still working is a
        // worse trade than waiting for the next trigger.
        if (trigger !== 'local-change') {
          await refreshViews()
        }
        if (trigger === 'remote-change') {
          toast(translate.current('settings-page:google-drive-pulled-changes'))
        }
        if (result.data.memoConflicts > 0) {
          toast(
            translate.current(
              'settings-page:google-drive-sync-conflicts',
              result.data.memoConflicts,
            ),
          )
        }
      } finally {
        endSync(syncedAt)
      }
    }

    const debouncer = createDebouncer({
      idleMs: AUTO_SYNC_IDLE_MS,
      maxWaitMs: AUTO_SYNC_MAX_WAIT_MS,
      flush: () => {
        void sync('local-change')
      },
    })

    // Opening the app is the one moment both devices are guaranteed to reach,
    // so it is where a change made elsewhere actually arrives.
    void sync('startup')

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
        void sync('visible')
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
          void sync('remote-change')
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
