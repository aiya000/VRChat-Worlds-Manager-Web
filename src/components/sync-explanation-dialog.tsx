'use client'

import { useRouter } from 'next/navigation'
import { useState, type FC } from 'react'
import { ExplanationDialog } from '@/components/explanation-dialog'
import { useLocalization } from '@/hooks/use-localization'
import { rememberSyncExplained } from '@/lib/services/sync-explanation'

/** The settings screen, opened on the tab that has the connect button. */
export const SYNC_SETTINGS_PATH = '/listview/settings?tab=sync'

/**
 * What the dialog is standing in front of.
 *
 * - `sync`: a press that will sync once the reader says so. Shown before
 *   every press until "don't show this again" is ticked
 * - `connect`: a press on a device that is not connected yet, which can only
 *   lead to the settings screen
 * - `info`: reading it again, with nothing to do afterwards
 */
export type SyncExplanationMode = 'sync' | 'connect' | 'info'

/**
 * What syncing is, how it is started, and what it needs -- said before the
 * first press, rather than discovered afterwards.
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
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const sections = [
    {
      title: t('sync-explanation:what-title'),
      body: t('sync-explanation:what'),
    },
    {
      title: t('sync-explanation:how-title'),
      body: t('sync-explanation:how'),
    },
    {
      title: t('sync-explanation:needs-title'),
      body: t('sync-explanation:needs'),
    },
  ]

  const primary =
    mode === 'connect'
      ? {
          label: t('sync-explanation:action-connect'),
          onClick: () => router.push(SYNC_SETTINGS_PATH),
        }
      : mode === 'sync'
        ? {
            label: t('sync-explanation:action-sync'),
            onClick: () => {
              if (dontShowAgain) {
                rememberSyncExplained()
              }
              onProceed?.()
            },
          }
        : undefined

  return (
    <ExplanationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('sync-explanation:title')}
      sections={sections}
      primary={primary}
      dontShowAgain={
        mode === 'sync'
          ? { checked: dontShowAgain, onChange: setDontShowAgain }
          : undefined
      }
      testId="sync-explanation"
    />
  )
}
