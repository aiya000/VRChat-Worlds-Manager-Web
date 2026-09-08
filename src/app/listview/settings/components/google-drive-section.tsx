'use client'

import { Cloud, RefreshCw, Unlink } from 'lucide-react'
import { useEffect, useEffectEvent, useState, type FC } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useLocalization } from '@/hooks/use-localization'
import { commands } from '@/lib/commands'
import { notifyDriveConnectionChanged } from '@/lib/services/drive-connection-changed'
import { VrProjectionNotice } from '@/components/vr-projection-notice'
import {
  takeGoogleAuthResume,
  type GoogleAuthResume,
} from '@/lib/services/google-auth-service'
import { refreshViews } from '@/lib/services/refresh-views'
import {
  syncStepPercentage,
  type SyncStep,
} from '@/lib/services/drive-sync-service'
import {
  endSync,
  subscribeToSyncActivity,
  tryBeginSync,
} from '@/lib/services/sync-activity'
import { SyncExplanationDialog } from '@/components/sync-explanation-dialog'
import {
  msUntilRelativeTimeChanges,
  relativeTime,
} from '@/lib/sync/relative-time'

/** The settings screen, opened on this card, which is where a press here comes back to. */
const SYNC_SETTINGS_PATH = '/listview/settings?tab=sync'

/**
 * Connect, disconnect, and one button that syncs.
 *
 * Syncing happens only from a press (#124). The list view has a button that
 * runs the same sync, so this screen has to keep out of its way: it must not
 * start a second sync on top of one already running from there, and it has to
 * notice when that one moves the "last synced" line underneath it.
 *
 * A press is also the only way back from an expired hour: a token cannot be
 * renewed without leaving for Google, and this is one of the two buttons that
 * leave. Whichever press left, the browser comes back to `returnTo`, and this
 * card picks the trip's result up when it mounts there (`takeGoogleAuthResume`).
 */
export const GoogleDriveSection: FC<{
  /**
   * Where Google's consent screen returns to. The settings screen by default;
   * the first-run setup passes its own, so that it reopens on the Drive step.
   */
  returnTo?: string
}> = ({ returnTo = SYNC_SETTINGS_PATH }) => {
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
  const [syncingElsewhere, setSyncingElsewhere] = useState(false)
  const [explaining, setExplaining] = useState(false)

  /**
   * One press of the button: which failures are worth a sentence, and which
   * of them are not failures at all.
   */
  const sync = async () => {
    // Refused rather than queued: the list's button may already be doing
    // exactly this, and a second one would only merge against a file the
    // first is about to replace.
    if (!tryBeginSync()) {
      return
    }
    setSyncing(true)
    setStep('authorizing')
    let syncedAt: number | null = null
    // Left "syncing" on purpose when the page is leaving for Google, so the
    // button does not flash back to idle for the last frame before it goes.
    let leaving = false
    try {
      const result = await commands.syncGoogleDriveNow(returnTo, setStep)
      if (result.status === 'error') {
        toast(t('general:error-title'), { description: result.error })
        return
      }
      if (result.data.kind === 'redirecting') {
        leaving = true
        return
      }
      if (result.data.kind === 'reauth-needed') {
        toast(t('settings-page:google-drive-reauth-needed'))
        return
      }

      syncedAt = result.data.syncedAt
      setLastSyncedAt(syncedAt)
      toast(t('general:success-title'), {
        description:
          result.data.memoConflicts > 0
            ? t(
                'settings-page:google-drive-sync-conflicts',
                result.data.memoConflicts,
              )
            : t('settings-page:google-drive-sync-success'),
      })
      // What came down is in the database; the lists behind this screen do
      // not read it again on their own.
      await refreshViews()
    } finally {
      if (!leaving) {
        endSync(syncedAt)
        setSyncing(false)
        setStep(null)
      }
    }
  }

  /**
   * What the trip to Google came to. Granted, the connection is already
   * recorded and only the intent is left to carry out; denied, there is a
   * sentence to say and nothing else to do.
   */
  const resume = useEffectEvent((outcome: GoogleAuthResume) => {
    if (outcome.outcome === 'denied') {
      toast(t('settings-page:google-drive-denied'))
      return
    }
    setConnected(true)
    notifyDriveConnectionChanged()
    if (outcome.intent === 'sync') {
      void sync()
    }
  })

  useEffect(() => {
    const outcome = takeGoogleAuthResume()
    commands.isGoogleDriveConnected().then((result) => {
      // Not `false`: "we could not read it" is a different thing to say than
      // "you are not connected", and showing the second for the first invites
      // reconnecting something that was never disconnected.
      if (result.status === 'error') {
        setUnreadable(result.error)
        return
      }
      setConnected(result.data)
      // Only once the state is known, so a sync that resumes finds the card
      // already showing the connection it is about to use.
      if (outcome !== null) {
        resume(outcome)
      }
    })
    commands.googleDriveLastSyncedAt().then((result) => {
      setLastSyncedAt(result.status === 'ok' ? result.data : null)
    })
  }, [])

  useEffect(
    () =>
      subscribeToSyncActivity((activity) => {
        setSyncingElsewhere(activity.running)
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
    const result = await commands.connectGoogleDrive(returnTo)
    if (result.status === 'error') {
      toast(t('general:error-title'), { description: result.error })
      setBusy(false)
      return
    }
    if (result.data.kind === 'redirecting') {
      // Still busy: the page is on its way to Google.
      return
    }
    setConnected(true)
    notifyDriveConnectionChanged()
    setBusy(false)
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
      notifyDriveConnectionChanged()
    } finally {
      setBusy(false)
    }
  }

  /**
   * How far along a sync is.
   *
   * A percentage rather than a spinner alone: a sync that has stopped and a
   * sync that is slow look identical otherwise, and the first one that went
   * wrong sat on "syncing" with nothing to say whether anything was still
   * happening.
   *
   */
  const progress = (
    <div className="space-y-1 text-sm text-muted-foreground">
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
  )

  return (
    <Card
      className="flex flex-col gap-4 rounded-lg border p-4"
      data-testid="google-drive-section"
    >
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
            disabled={busy || syncing || syncingElsewhere}
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

      {/* Beside the connect button, and only while there is one: connecting is
          the step that goes to Google's sign-in, and this says where to open
          the app so that Google will answer. This card is also the Drive step
          of the first-run setup, so the same words appear there. */}
      {connected !== true && <VrProjectionNotice />}

      {/* Outside the connected block on purpose. It describes what connecting
          gets you -- a sync each time a button is pressed, and nothing else --
          which is what someone deciding whether to connect at all needs to
          read, and this card is also the Google Drive step of the first-run
          setup. */}
      <div className="text-sm text-muted-foreground">
        {t('settings-page:google-drive-how-it-works')}
      </div>
      <Button
        variant="ghost"
        className="h-10 w-fit px-2 text-sm"
        onClick={() => setExplaining(true)}
      >
        {t('settings-page:google-drive-show-explanation')}
      </Button>
      <SyncExplanationDialog
        open={explaining}
        mode="info"
        onOpenChange={setExplaining}
      />

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
            disabled={busy || syncing || syncingElsewhere}
            onClick={sync}
          >
            <RefreshCw
              className={`h-5 w-5 ${syncing || syncingElsewhere ? 'animate-spin' : ''}`}
              aria-hidden
            />
            {syncing || syncingElsewhere
              ? t('settings-page:google-drive-syncing')
              : t('settings-page:google-drive-sync-now')}
          </Button>
          {syncing && progress}
        </div>
      )}
    </Card>
  )
}
