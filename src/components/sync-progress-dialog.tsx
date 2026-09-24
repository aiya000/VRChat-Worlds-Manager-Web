'use client'

import { LoaderCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useLocalization } from '@/hooks/use-localization'
import { syncStepPercentage } from '@/lib/services/drive-sync-service'
import {
  abortSync,
  canAbortSync,
  subscribeToSyncActivity,
  syncActivity,
} from '@/lib/services/sync-activity'

/**
 * Covers the app for as long as a Google Drive sync runs (#221).
 *
 * A sync writes back to this device what it read when it started, so a folder
 * filed or a world deleted in the meantime would be undone as it finishes.
 * Holding everything still until then is the plain way to make that
 * impossible; the stop button is what keeps a sync that has stalled (#220)
 * from holding the whole app with it.
 *
 * In the root layout rather than the list: the first-run setup syncs from the
 * same Drive card, outside the list view.
 */
export function SyncProgressDialog() {
  const { t } = useLocalization()
  const [activity, setActivity] = useState(syncActivity)

  useEffect(() => subscribeToSyncActivity(setActivity), [])

  const { running, step, aborting } = activity
  const percentage = step === null ? 0 : syncStepPercentage(step)

  return (
    // Controlled and never closed from inside: Escape would otherwise hand
    // the app back while the sync is still going to overwrite it.
    <AlertDialog open={running}>
      <AlertDialogContent data-testid="sync-progress-dialog">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden />
            {t('sync-dialog:title')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('sync-dialog:description')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="flex flex-col gap-2">
          <Progress value={percentage} aria-hidden />
          <p
            className="text-sm"
            data-testid="sync-progress-step"
            aria-live="polite"
          >
            {step === null
              ? t('settings-page:google-drive-syncing')
              : `${percentage}% — ${t(`settings-page:google-drive-step-${step}`)}`}
          </p>
        </div>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          {step === 'applying' && (
            <p className="text-sm text-muted-foreground">
              {t('sync-dialog:abort-unavailable')}
            </p>
          )}
          <Button
            variant="outline"
            className="h-12 w-full text-base"
            disabled={!canAbortSync(activity)}
            onClick={abortSync}
            data-testid="sync-abort-button"
          >
            {aborting ? t('sync-dialog:aborting') : t('sync-dialog:abort')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
