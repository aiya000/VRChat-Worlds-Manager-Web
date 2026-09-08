'use client'

import { CircleHelpIcon } from 'lucide-react'
import { useState, type FC } from 'react'
import {
  ExplanationDialog,
  type ExplanationSection,
} from '@/components/explanation-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useLocalization } from '@/hooks/use-localization'

/**
 * A "?" standing beside a field's label, for a field whose name does not say
 * enough on its own.
 *
 * A tooltip opens on hover and on focus and on nothing else, so on a phone or
 * through a VR laser its sentence could not be read at all. Pressing this
 * opens the same words as a dialog, and the hover stays as a shortcut for a
 * mouse -- the same bargain [[HelpBadge]] makes for a button.
 */
export const HelpHint: FC<{
  label: string
  tooltip: string
  title: string
  sections: ExplanationSection[]
  testId?: string
}> = ({ label, tooltip, title, sections, testId }) => {
  const { t } = useLocalization()
  const [explaining, setExplaining] = useState(false)

  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            {/* The negative margin keeps a target a finger can find from
                making the label row taller than the rows beside it. */}
            <button
              type="button"
              onClick={() => setExplaining(true)}
              aria-label={t('general:help-about', label)}
              data-testid={testId === undefined ? undefined : `${testId}-help`}
              className="-my-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground"
            >
              <CircleHelpIcon className="h-4 w-4" aria-hidden />
            </button>
          </TooltipTrigger>
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
      <ExplanationDialog
        open={explaining}
        onOpenChange={setExplaining}
        title={title}
        sections={sections}
        testId={testId === undefined ? undefined : `${testId}-explanation`}
      />
    </>
  )
}
