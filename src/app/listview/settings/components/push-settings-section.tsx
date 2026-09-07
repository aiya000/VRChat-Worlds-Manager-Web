'use client'

import { ArrowUpFromLine, RefreshCw } from 'lucide-react'
import { useEffect, useState, type FC } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useLocalization } from '@/hooks/use-localization'
import { commands } from '@/lib/commands'
import { subscribeToDriveConnectionChanged } from '@/lib/services/drive-connection-changed'
import {
  syncStepPercentage,
  type SyncStep,
} from '@/lib/services/drive-sync-service'
import { refreshViews } from '@/lib/services/refresh-views'
import {
  endSync,
  subscribeToSyncActivity,
  tryBeginSync,
} from '@/lib/services/sync-activity'

/**
 * The one control that overrules a promise another device was given: it
 * hands this device's settings to every other device, once.
 *
 * Its own card, set apart from the Google Drive card above it (#119): the
 * everyday "sync now" and this are not the same weight of action, and a
 * single divider between them made them look like it. It appears only once
 * this device is connected, since there is nowhere to send anything before.
 */
export const PushSettingsSection: FC = () => {
  const { t } = useLocalization()
  const [connected, setConnected] = useState(false)
  const [pushing, setPushing] = useState(false)
  const [step, setStep] = useState<SyncStep | null>(null)
  const [syncingElsewhere, setSyncingElsewhere] = useState(false)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    // Read once, and again whenever the card above connects or disconnects:
    // the two cards do not share state, and this one has to appear the
    // moment there is somewhere to send to.
    const read = () => {
      commands.isGoogleDriveConnected().then((result) => {
        setConnected(result.status === 'ok' && result.data)
      })
    }
    read()
    return subscribeToDriveConnectionChanged(read)
  }, [])

  useEffect(
    () =>
      subscribeToSyncActivity((activity) => {
        setSyncingElsewhere(activity.running)
      }),
    [],
  )

  const push = async () => {
    // Refused rather than queued: a sync started from another button would
    // otherwise race this one against the same file.
    if (!tryBeginSync()) {
      return
    }
    setPushing(true)
    setStep('authorizing')
    let syncedAt: number | null = null
    try {
      const result = await commands.pushSettingsToAllDevices(setStep)
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
      toast(t('general:success-title'), {
        description:
          result.data.memoConflicts > 0
            ? t(
                'settings-page:google-drive-sync-conflicts',
                result.data.memoConflicts,
              )
            : t('settings-page:push-settings-success'),
      })
      await refreshViews()
    } finally {
      endSync(syncedAt)
      setPushing(false)
      setStep(null)
    }
  }

  if (!connected) {
    return null
  }

  return (
    <Card
      className="flex flex-col gap-3 rounded-lg border p-4"
      data-testid="push-settings-block"
    >
      <Label className="text-base font-medium">
        {t('settings-page:push-settings-title')}
      </Label>
      <div className="whitespace-pre-line text-sm text-muted-foreground">
        {t('settings-page:push-settings-description')}
      </div>
      <Button
        variant="outline"
        className="h-12 w-full gap-2 text-base"
        disabled={pushing || syncingElsewhere}
        onClick={() => setConfirming(true)}
      >
        {pushing ? (
          <RefreshCw className="h-5 w-5 animate-spin" aria-hidden />
        ) : (
          <ArrowUpFromLine className="h-5 w-5" aria-hidden />
        )}
        {pushing
          ? t('settings-page:google-drive-syncing')
          : t('settings-page:push-settings-button')}
      </Button>
      {pushing && (
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
      )}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('settings-page:push-settings-confirm-title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="whitespace-pre-line">
              {t('settings-page:push-settings-confirm-description')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('general:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={push}>
              {t('settings-page:push-settings-confirm-action')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
