'use client'

import { CloudOff, RefreshCw } from 'lucide-react'
import { useEffect, useEffectEvent, useState, type FC } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { HelpBadge } from '@/components/help-badge'
import {
  SyncExplanationDialog,
  type SyncExplanationMode,
} from '@/components/sync-explanation-dialog'
import { useAbandonedGoogleTrip } from '@/hooks/use-abandoned-google-trip'
import { useLocalization } from '@/hooks/use-localization'
import { commands } from '@/lib/commands'
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
  syncActivity,
  tryBeginSync,
} from '@/lib/services/sync-activity'
import { wasSyncExplained } from '@/lib/services/sync-explanation'
import {
  lastLocalChangeAt,
  subscribeToUnsyncedChanges,
} from '@/lib/services/unsynced-changes'
import {
  msUntilRelativeTimeChanges,
  relativeTime,
} from '@/lib/sync/relative-time'
import { hasUnsyncedChanges } from '@/lib/sync/unsynced-changes'

/**
 * The sync button on the list, where the person actually is.
 *
 * Syncing happens only from a press (#124), so the press has to be reachable
 * without a trip to the settings screen. This is the same sync the settings
 * button runs, without the step-by-step progress: here the spinner is the
 * progress, and the toast is the report.
 *
 * Two things are said without being asked: that a change made here has not
 * been sent yet (the dot), and -- before each press, until told not to --
 * what pressing does. The "?" in the corner says it again on demand. On a
 * device that is not connected the button leads to where connecting happens,
 * rather than pretending to sync.
 */
export const DriveSyncButton: FC = () => {
  const { t } = useLocalization()
  const [connected, setConnected] = useState<boolean | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [localChangedAt, setLocalChangedAt] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(() => syncActivity().running)
  const [step, setStep] = useState<SyncStep | null>(null)
  const [now, setNow] = useState(() => Date.now())
  const [explaining, setExplaining] = useState<SyncExplanationMode | null>(null)

  useEffect(
    () =>
      subscribeToSyncActivity((activity) => {
        setSyncing(activity.running)
        if (activity.lastSyncedAt !== null) {
          setLastSyncedAt(activity.lastSyncedAt)
        }
      }),
    [],
  )

  useEffect(() => subscribeToUnsyncedChanges(setLocalChangedAt), [])

  // The press below leaves this button spinning on the way to Google. Back
  // from there without going, it is still spinning.
  useAbandonedGoogleTrip(() => {
    setSyncing(false)
    setStep(null)
  })

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

  const sync = async () => {
    // Refused rather than queued: the settings button may already be running
    // this very sync, and a second one would only merge against a file the
    // first is about to replace.
    if (!tryBeginSync()) {
      return
    }
    setStep('authorizing')
    let syncedAt: number | null = null
    // Left spinning on purpose when the page is leaving for Google, so the
    // button does not flash back to idle for the last frame before it goes.
    let leaving = false
    try {
      // Back to this very list afterwards, filters and all.
      const result = await commands.syncGoogleDriveNow(
        window.location.pathname + window.location.search,
        setStep,
      )
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
      toast(t('general:success-title'), {
        description:
          result.data.memoConflicts > 0
            ? t(
                'settings-page:google-drive-sync-conflicts',
                result.data.memoConflicts,
              )
            : t('settings-page:google-drive-sync-success'),
      })
      // What came down is in the database; nothing on screen reads it again
      // on its own.
      await refreshViews()
    } finally {
      if (!leaving) {
        endSync(syncedAt)
        setStep(null)
      }
    }
  }

  /**
   * What the trip to Google came to. Granted, the connection is already
   * recorded and the sync that was asked for runs now; denied, there is a
   * sentence to say and nothing else to do.
   */
  const resume = useEffectEvent((outcome: GoogleAuthResume) => {
    if (outcome.outcome === 'denied') {
      toast(t('settings-page:google-drive-denied'))
      return
    }
    setConnected(true)
    if (outcome.intent === 'sync') {
      void sync()
    }
  })

  useEffect(() => {
    const outcome = takeGoogleAuthResume()
    commands.isGoogleDriveConnected().then((result) => {
      setConnected(result.status === 'ok' ? result.data : false)
      if (outcome !== null) {
        resume(outcome)
      }
    })
    commands.googleDriveLastSyncedAt().then((result) => {
      setLastSyncedAt(result.status === 'ok' ? result.data : null)
    })
    setLocalChangedAt(lastLocalChangeAt())
  }, [])

  const press = () => {
    if (connected !== true) {
      setExplaining('connect')
      return
    }
    if (!wasSyncExplained()) {
      setExplaining('sync')
      return
    }
    void sync()
  }

  const proceedAfterExplanation = () => {
    void sync()
  }

  if (connected === null) {
    return null
  }

  const unsynced =
    connected && !syncing && hasUnsyncedChanges(localChangedAt, lastSyncedAt)

  /**
   * How far along, in the room the list has.
   *
   * A spinner alone cannot tell a sync that is slow from one that has
   * stopped, which is why the settings screen counts the steps off. The list
   * counts the same steps, but only the percentage is written on the button
   * (#160): it stands where the word "同期" stood and is never longer than
   * it, so it cannot widen a row that is already at its limit at 200% on a
   * phone. The step itself is a sentence, and a sentence in there would be --
   * measured at 200% on a 900px window, the button went from 156px wide to
   * 663px, past the edge of a row whose container does not shrink.
   *
   * So the sentence goes where width is free: the accessible name, which is
   * where someone who cannot see the spinner is reading anyway. Not the
   * tooltip -- the button is disabled while it works, and a disabled button
   * takes no pointer events to open one with.
   */
  const percentage = step === null ? null : `${syncStepPercentage(step)}%`
  const stepText =
    step === null ? null : t(`settings-page:google-drive-step-${step}`)

  const label = !connected
    ? t('list-view:sync-connect')
    : syncing
      ? // The whole of it: a screen reader is not short of room.
        stepText === null
        ? t('settings-page:google-drive-syncing')
        : `${percentage} — ${stepText}`
      : unsynced
        ? `${t('list-view:sync')} — ${t('list-view:sync-unsynced')}`
        : t('list-view:sync')

  const tooltip =
    connected && lastSyncedAt !== null
      ? `${t('list-view:sync-tooltip')}\n${t(
          'settings-page:google-drive-last-synced',
          describeAgo(lastSyncedAt),
        )}`
      : t('list-view:sync-tooltip')

  return (
    <>
      {/* The word stays at every width: two characters beside the icon are
          what tell this button apart from the one that fetches favourites,
          and a VR overlay panel can spare that much. Default height, like
          the buttons it sits beside; a taller one sat visibly lower. */}
      <HelpBadge
        tooltip={tooltip}
        helpLabel={t('general:help-about', t('list-view:sync'))}
        onHelp={() => setExplaining('info')}
        helpTestId="drive-sync-help"
      >
        <Button
          variant={connected ? 'outline' : 'ghost'}
          className="relative shrink-0 gap-2 px-3"
          disabled={syncing}
          onClick={press}
          aria-label={label}
          data-testid="drive-sync-button"
          data-unsynced={unsynced ? 'true' : undefined}
        >
          {connected ? (
            <RefreshCw
              className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`}
              aria-hidden
            />
          ) : (
            <CloudOff className="h-5 w-5" aria-hidden />
          )}
          <span data-testid="drive-sync-progress">
            {syncing && percentage !== null
              ? percentage
              : connected
                ? t('list-view:sync')
                : t('list-view:connect')}
          </span>
          {unsynced && (
            <span
              className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary"
              aria-hidden
            />
          )}
        </Button>
      </HelpBadge>

      <SyncExplanationDialog
        open={explaining !== null}
        mode={explaining ?? 'info'}
        onOpenChange={(open) => {
          if (!open) {
            setExplaining(null)
          }
        }}
        onProceed={proceedAfterExplanation}
      />
    </>
  )
}
