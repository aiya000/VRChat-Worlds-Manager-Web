'use client'

import type { FC, ReactNode } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useLocalization } from '@/hooks/use-localization'

/**
 * A "?" in the corner of a button, for a button whose word does not say
 * enough on its own.
 *
 * Hovering the button gives a sentence and points at the "?"; tapping the
 * "?" opens the full explanation the caller provides. A tap is the path that
 * works everywhere -- a VR laser and a finger have no hover -- and the hover
 * is only a shortcut for a mouse.
 *
 * The "?" is a sibling of the button, not a child: a button may not contain
 * another, and the two have to be pressed separately.
 */
export const HelpBadge: FC<{
  tooltip: string
  helpLabel: string
  onHelp: () => void
  helpTestId?: string
  children: ReactNode
}> = ({ tooltip, helpLabel, onHelp, helpTestId, children }) => {
  const { t } = useLocalization()

  return (
    <span className="relative inline-flex shrink-0">
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{children}</TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="max-w-xs whitespace-pre-line"
          >
            {tooltip}
            {'\n'}
            {t('general:help-hint')}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {/* Visually a small circle; the hit area is a little larger than it
          looks, because a small target is what this row otherwise lacks. */}
      <button
        type="button"
        onClick={onHelp}
        aria-label={helpLabel}
        data-testid={helpTestId}
        className="absolute -bottom-1.5 -right-1.5 flex h-6 w-6 items-center justify-center rounded-full"
      >
        <span
          aria-hidden
          className="flex h-4 w-4 items-center justify-center rounded-full border bg-background text-[10px] font-semibold leading-none text-muted-foreground"
        >
          ?
        </span>
      </button>
    </span>
  )
}
