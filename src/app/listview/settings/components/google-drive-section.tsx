'use client'

import { Cloud, RefreshCw, Unlink } from 'lucide-react'
import { useEffect, useState, type FC } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useLocalization } from '@/hooks/use-localization'
import { commands } from '@/lib/commands'
import { preloadGoogleIdentityScript } from '@/lib/services/google-auth-service'
import {
  syncStepPercentage,
  type SyncStep,
} from '@/lib/services/drive-sync-service'
import {
  endSync,
  subscribeToSyncActivity,
  tryBeginSync,
} from '@/lib/services/sync-activity'
import {
  msUntilRelativeTimeChanges,
  relativeTime,
} from '@/lib/sync/relative-time'

/**
 * Whether the app was opened from the home screen rather than in a browser tab.
 *
 * It matters because Google's consent window is then a Chrome Custom Tab, a
 * separate process that may not be able to hand its answer back -- see #104.
 * Until that is fixed by not using a second window at all, the honest thing is
 * to say so before someone presses the button and waits.
 */
function isRunningInstalled(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches ||
    // Safari on iOS predates `display-mode` and reports it here instead.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Connect, disconnect, and one button that syncs.
 *
 * The app also syncs on its own now (`useDriveAutoSync`), which this screen
 * has to keep out of the way of: the button is the one place a sync reports
 * what it did, so it must not start a second one on top of an automatic sync
 * already running, and it has to notice when one of those moves the "last
 * synced" line underneath it.
 *
 * The button remains the only way back from an expired hour: a token cannot
 * be renewed without a gesture, and this is the gesture.
 */
export const GoogleDriveSection: FC = () => {
  const { t } = useLocalization()
  /**
   * Moved on whenever "3 minutes ago" would stop being true, so the line ages
   * while it is being looked at rather than only when the screen is reopened.
   */
  const [now, setNow] = useState(() => Date.now())
  const [connected, setConnected] = useState<boolean | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [step, setStep] = useState<SyncStep | null>(null)
  const [unreadable, setUnreadable] = useState<string | null>(null)
  const [installed, setInstalled] = useState(false)
  const [autoSyncing, setAutoSyncing] = useState(false)

  useEffect(() => {
    // Loaded ahead of the click that needs it: Google requires the token
    // request to happen synchronously within a user gesture, which an await
    // on the script tag's own load would break.
    preloadGoogleIdentityScript()
    setInstalled(isRunningInstalled())

    commands.isGoogleDriveConnected().then((result) => {
      // Not `false`: "we could not read it" is a different thing to say than
      // "you are not connected", and showing the second for the first invites
      // reconnecting something that was never disconnected.
      if (result.status === 'error') {
        setUnreadable(result.error)
        return
      }
      setConnected(result.data)
    })
    commands.googleDriveLastSyncedAt().then((result) => {
      setLastSyncedAt(result.status === 'ok' ? result.data : null)
    })
  }, [])

  useEffect(
    () =>
      subscribeToSyncActivity((activity) => {
        setAutoSyncing(activity.running)
        if (activity.lastSyncedAt !== null) {
          setLastSyncedAt(activity.lastSyncedAt)
        }
      }),
    [],
  )

  useEffect(() => {
    if (lastSyncedAt === null) {
      return
    }
    const timer = setTimeout(
      () => setNow(Date.now()),
      msUntilRelativeTimeChanges(lastSyncedAt, now),
    )
    return () => clearTimeout(timer)
  }, [lastSyncedAt, now])

  const describeAgo = (at: number): string => {
    const { unit, count } = relativeTime(at, now)
    return unit === 'now'
      ? t('settings-page:relative-time-now')
      : t(`settings-page:relative-time-${unit}`, count)
  }

  const connect = async () => {
    setBusy(true)
    try {
      const result = await commands.connectGoogleDrive()
      if (result.status === 'error') {
        toast(t('general:error-title'), { description: result.error })
        return
      }
      setConnected(true)
    } finally {
      setBusy(false)
    }
  }

  const disconnect = async () => {
    setBusy(true)
    try {
      const result = await commands.disconnectGoogleDrive()
      if (result.status === 'error') {
        toast(t('general:error-title'), { description: result.error })
        return
      }
      setConnected(false)
    } finally {
      setBusy(false)
    }
  }

  const syncNow = async () => {
    // Refused rather than queued: an automatic sync is already doing exactly
    // this, and a second one would only merge against a file the first is
    // about to replace.
    if (!tryBeginSync()) {
      return
    }
    setSyncing(true)
    setStep('authorizing')
    let syncedAt: number | null = null
    try {
      const result = await commands.syncGoogleDriveNow(setStep)
      if (result.status === 'error') {
        toast(t('general:error-title'), { description: result.error })
        return
      }

      if (result.data.kind === 'reauth-needed') {
        toast(t('settings-page:google-drive-reauth-needed'))
        return
      }
      if (result.data.kind === 'dismissed') {
        toast(t('settings-page:google-drive-dismissed'))
        return
      }
      if (result.data.kind === 'unanswered') {
        toast(t('general:error-title'), {
          description: t('settings-page:google-drive-unanswered'),
        })
        return
      }

      syncedAt = result.data.syncedAt
      setLastSyncedAt(syncedAt)
      toast(t('general:success-title'), {
        description:
          result.data.memoConflicts === 0
            ? t('settings-page:google-drive-sync-success')
            : t(
                'settings-page:google-drive-sync-conflicts',
                result.data.memoConflicts,
              ),
      })
    } finally {
      endSync(syncedAt)
      setSyncing(false)
      setStep(null)
    }
  }

  return (
    <Card className="flex flex-col gap-4 rounded-lg border p-4">
      {installed && (
        // Said before the button rather than after the wait: from the home
        // screen, pressing it can end on a blank page that never comes back.
        // #104 removes the second window that causes this.
        <div className="rounded-md border border-amber-500/50 p-3 text-sm">
          {t('settings-page:google-drive-installed-warning')}
        </div>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col space-y-1.5">
          <Label className="text-base font-medium">
            {t('settings-page:google-drive-title')}
          </Label>
          <div className="text-sm text-muted-foreground">
            {unreadable !== null
              ? t('settings-page:google-drive-state-unreadable')
              : connected === true
                ? t('settings-page:google-drive-connected')
                : t('settings-page:google-drive-description')}
          </div>
        </div>
        {connected === true ? (
          <Button
            variant="outline"
            className="gap-2"
            disabled={busy || syncing || autoSyncing}
            onClick={disconnect}
          >
            <Unlink className="h-4 w-4" />
            <span className="text-sm">
              {t('settings-page:google-drive-disconnect')}
            </span>
          </Button>
        ) : (
          <Button
            variant="outline"
            className="gap-2"
            disabled={busy || connected === null}
            onClick={connect}
          >
            <Cloud className="h-4 w-4" />
            <span className="text-sm">
              {t('settings-page:google-drive-connect')}
            </span>
          </Button>
        )}
      </div>

      {/* Outside the connected block on purpose. It describes what connecting
          gets you -- one press, then an hour that looks after itself -- which
          is what someone deciding whether to connect at all needs to read,
          and this card is also the Google Drive step of the first-run setup. */}
      <div className="text-sm text-muted-foreground">
        {t('settings-page:google-drive-auto-sync-note')}
      </div>

      {connected === true && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <div
            className="text-sm text-muted-foreground"
            // The exact moment is still available, just not in the way of the
            // answer someone actually wants.
            title={
              lastSyncedAt === null
                ? undefined
                : new Date(lastSyncedAt).toLocaleString()
            }
          >
            {lastSyncedAt === null
              ? t('settings-page:google-drive-never-synced')
              : t(
                  'settings-page:google-drive-last-synced',
                  describeAgo(lastSyncedAt),
                )}
          </div>
          {/* Deliberately full width and tall: a VR controller aims a laser,
              and this is the button that also stands in for signing back in
              once the hour-long token runs out. */}
          <Button
            className="h-12 w-full gap-2 text-base"
            disabled={busy || syncing || autoSyncing}
            onClick={syncNow}
          >
            <RefreshCw
              className={`h-5 w-5 ${syncing || autoSyncing ? 'animate-spin' : ''}`}
              aria-hidden
            />
            {syncing || autoSyncing
              ? t('settings-page:google-drive-syncing')
              : t('settings-page:google-drive-sync-now')}
          </Button>
          {syncing && (
            <div className="space-y-1 text-sm text-muted-foreground">
              {/* A percentage rather than a spinner alone: a sync that has
                  stopped and a sync that is slow look identical otherwise,
                  and the first one that went wrong sat on "syncing" with
                  nothing to say whether anything was still happening. */}
              <div>
                {step === null
                  ? t('settings-page:google-drive-syncing')
                  : `${syncStepPercentage(step)}% — ${t(
                      `settings-page:google-drive-step-${step}`,
                    )}`}
              </div>
              <div className="text-xs">
                {t('settings-page:google-drive-do-not-reload')}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
