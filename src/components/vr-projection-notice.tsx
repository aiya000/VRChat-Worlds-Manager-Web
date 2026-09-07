'use client'

import { MonitorUp } from 'lucide-react'
import type { FC } from 'react'
import { useLocalization } from '@/hooks/use-localization'
import { cn } from '@/lib/utils'

/**
 * How to open this app somewhere Google's window can open.
 *
 * Google has refused OAuth inside embedded WebViews since 2021-09-30, and the
 * `403 disallowed_useragent` that follows is not something this app can work
 * around. The answer is therefore a way of using it rather than a change to
 * it: open it in a desktop browser and project that window into VR, where the
 * browser is a real one and the consent window opens like any other (#91).
 *
 * Phrased as a recommendation, not as a warning about panel browsers: what
 * those actually do here is not established until #96 says so, and a warning
 * would be read as one.
 */
export const VrProjectionNotice: FC<{ className?: string }> = ({
  className,
}) => {
  const { t } = useLocalization()

  return (
    <div
      className={cn(
        'flex gap-2 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground',
        className,
      )}
      data-testid="vr-projection-notice"
    >
      <MonitorUp className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex flex-col gap-1">
        <span className="font-medium text-foreground">
          {t('vr-setup:projection-title')}
        </span>
        <span>{t('vr-setup:projection-recommended')}</span>
        <span>{t('vr-setup:projection-why')}</span>
      </div>
    </div>
  )
}
