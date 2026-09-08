'use client'

import { Minus, Plus } from 'lucide-react'
import type { FC } from 'react'
import { Button } from '@/components/ui/button'
import { useLocalization } from '@/hooks/use-localization'
import { UI_SCALES, type UiScale } from '@/lib/ui-scale'

/**
 * The scale as a percentage, with a step either side of it.
 *
 * Deliberately not a `Select`. When the whole document was zoomed, a popover
 * -- positioned by measuring its trigger -- was drawn at twice the offset it
 * should be at 200%, off the side of a 1280px window, so the control that
 * sets the size was unusable at exactly the sizes it sets. The document is no
 * longer zoomed, but two buttons still need no measuring, and a pair of large
 * targets suits a VR laser better than a list does anyway.
 */
export const UiScaleStepper: FC<{
  value: UiScale
  onChange: (value: UiScale) => void
  testIdPrefix: string
}> = ({ value, onChange, testIdPrefix }) => {
  const { t } = useLocalization()

  const index = UI_SCALES.indexOf(value)
  const step = (by: number) => {
    const next = UI_SCALES[index + by]
    if (next !== undefined) {
      onChange(next)
    }
  }

  return (
    <div
      // `h-9`, the default button height: a taller control sits visibly
      // lower than the buttons it shares the row with.
      //
      // `px-4` rather than the padding the border alone would want: the "?"
      // badge sits over the bottom-right corner of whatever it explains, and
      // at a narrower padding it covered a quarter of the "+" -- which a VR
      // laser then hit instead of the button.
      className="ui-control flex h-9 shrink-0 items-center gap-1 rounded-md border px-4"
      data-testid={testIdPrefix}
    >
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={index <= 0}
        onClick={() => step(-1)}
        aria-label={t('general:ui-scale-smaller')}
        data-testid={`${testIdPrefix}-decrease`}
      >
        <Minus className="h-4 w-4" aria-hidden />
      </Button>
      <span className="min-w-[3.5rem] text-center text-sm tabular-nums">
        {`${value}%`}
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7"
        disabled={index >= UI_SCALES.length - 1}
        onClick={() => step(1)}
        aria-label={t('general:ui-scale-larger')}
        data-testid={`${testIdPrefix}-increase`}
      >
        <Plus className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  )
}
