'use client'

import { useRouter } from 'next/navigation'
import type { FC } from 'react'
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
import { useLocalization } from '@/hooks/use-localization'

/** The settings screen, opened on the tab that has the connect button. */
export const SYNC_SETTINGS_PATH = '/listview/settings?tab=sync'

/**
 * What the dialog is standing in front of.
 *
 * - `sync`: a press that will sync once the reader says so
 * - `connect`: a press on a device that is not connected yet, which can only
 *   lead to the settings screen
 * - `info`: reading it again, with nothing to do afterwards
 */
export type SyncExplanationMode = 'sync' | 'connect' | 'info'

/**
 * What syncing is, how it is started, and what it needs -- said once, before
 * the first press, rather than discovered afterwards.
 *
 * The "sync" action is a real click: Google's token request has to happen
 * inside a user gesture, and the caller's `onProceed` runs directly from it.
 */
export const SyncExplanationDialog: FC<{
  open: boolean
  mode: SyncExplanationMode
  onOpenChange: (open: boolean) => void
  onProceed?: () => void
}> = ({ open, mode, onOpenChange, onProceed }) => {
  const { t } = useLocalization()
  const router = useRouter()

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent data-testid="sync-explanation">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('sync-explanation:title')}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left text-sm text-muted-foreground">
              <section>
                <div className="font-medium text-foreground">
                  {t('sync-explanation:what-title')}
                </div>
                <p>{t('sync-explanation:what')}</p>
              </section>
              <section>
                <div className="font-medium text-foreground">
                  {t('sync-explanation:how-title')}
                </div>
                <p>{t('sync-explanation:how')}</p>
              </section>
              <section>
                <div className="font-medium text-foreground">
                  {t('sync-explanation:needs-title')}
                </div>
                <p>{t('sync-explanation:needs')}</p>
              </section>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {mode === 'info' ? (
            <AlertDialogCancel>{t('sync-explanation:close')}</AlertDialogCancel>
          ) : (
            <>
              <AlertDialogCancel>{t('general:cancel')}</AlertDialogCancel>
              {mode === 'connect' ? (
                <AlertDialogAction
                  onClick={() => router.push(SYNC_SETTINGS_PATH)}
                >
                  {t('sync-explanation:action-connect')}
                </AlertDialogAction>
              ) : (
                <AlertDialogAction onClick={onProceed}>
                  {t('sync-explanation:action-sync')}
                </AlertDialogAction>
              )}
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
