'use client'

import { ExternalLink, Globe } from 'lucide-react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import { ExplanationDialog } from '@/components/explanation-dialog'
import { useLocalization } from '@/hooks/use-localization'
import { DRIVE_SYNC_HOME } from '@/lib/drive-sync-origin'
import { cn } from '@/lib/utils'

/**
 * Says that Google Drive sync does not work at this address, and where it
 * does (#205).
 *
 * Shown only at `pages.dev`, where the app is still served but Google no
 * longer accepts a sign-in from. Two things it is careful to say: that the
 * rest of the app is unaffected, and that the data saved here does not
 * follow on its own -- a backup exported here and restored there is how it
 * moves.
 */
export const DriveSyncOriginNotice: FC<{
  hostname: string
  className?: string
}> = ({ hostname, className }) => {
  const { t } = useLocalization()

  return (
    <div
      className={cn(
        'flex gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground',
        className,
      )}
      data-testid="drive-sync-origin-notice"
    >
      <Globe className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-2">
        <span className="font-medium text-foreground">
          {t('drive-origin:title')}
        </span>
        <span>{t('drive-origin:unavailable-here', hostname)}</span>
        <span>{t('drive-origin:move')}</span>
        <Button asChild variant="outline" className="w-fit gap-2">
          <a href={DRIVE_SYNC_HOME} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-4 w-4" aria-hidden />
            {t('drive-origin:open')}
          </a>
        </Button>
      </div>
    </div>
  )
}

/**
 * The same notice as a dialog, for a press that would otherwise have left
 * for Google: the list view's sync button on a device that is not connected.
 */
export const DriveSyncOriginDialog: FC<{
  hostname: string
  open: boolean
  onOpenChange: (open: boolean) => void
}> = ({ hostname, open, onOpenChange }) => {
  const { t } = useLocalization()

  return (
    <ExplanationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('drive-origin:title')}
      sections={[
        {
          title: t('drive-origin:here-title'),
          body: t('drive-origin:unavailable-here', hostname),
        },
        {
          title: t('drive-origin:move-title'),
          body: t('drive-origin:move'),
        },
      ]}
      primary={{
        label: t('drive-origin:open'),
        // A new tab: from a PWA installed at `pages.dev`, navigating this
        // window to another origin would leave the installed app showing a
        // site it was not installed from.
        onClick: () => window.open(DRIVE_SYNC_HOME, '_blank', 'noopener'),
      }}
      testId="drive-sync-origin-dialog"
    />
  )
}
