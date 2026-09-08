'use client'

import { useEffect, useState, type FC } from 'react'
import { ExplanationDialog } from '@/components/explanation-dialog'
import { HelpBadge } from '@/components/help-badge'
import { UiScaleStepper } from '@/components/ui-scale-stepper'
import { useLocalization } from '@/hooks/use-localization'
import { commands } from '@/lib/commands'
import { subscribeToPreferencesChanged } from '@/lib/services/preferences-changed'
import { applyUiScale, DEFAULT_UI_SCALE, type UiScale } from '@/lib/ui-scale'

/**
 * The scale, where the person already is.
 *
 * It lived only in the settings screen at first, and that turned out to be a
 * one-way door: the settings entry is down a sidebar that has grown along with
 * everything else, and the control waiting at the end of it was a `Select`
 * that the zoom of the time drew off-screen (see `UiScaleStepper`). Here it is
 * reachable and pressable at any scale, and stepping back down to 100% is the
 * way out.
 *
 * The "?" carries what the settings screen says in prose, because a bare
 * percentage beside the sync button does not say what it scales.
 */
export const UiScaleControl: FC = () => {
  const { t } = useLocalization()
  const [uiScale, setUiScale] = useState<UiScale>(DEFAULT_UI_SCALE)
  const [explaining, setExplaining] = useState(false)

  useEffect(() => {
    const read = () => {
      void commands.getUiScale().then((result) => {
        if (result.status === 'ok') {
          setUiScale(result.data)
        }
      })
    }

    read()
    return subscribeToPreferencesChanged(read)
  }, [])

  const change = (value: UiScale) => {
    setUiScale(value)
    // Applied here rather than left to `UiScaleEffect`: writing a preference
    // raises no signal, so nothing else would redraw the page at the new size.
    applyUiScale(value)
    void commands.setUiScale(value)
  }

  return (
    <>
      <HelpBadge
        tooltip={t('list-view:ui-scale-tooltip')}
        helpLabel={t('general:help-about', t('list-view:ui-scale'))}
        onHelp={() => setExplaining(true)}
        helpTestId="ui-scale-help"
      >
        <div role="group" aria-label={t('list-view:ui-scale')}>
          <UiScaleStepper
            value={uiScale}
            onChange={change}
            testIdPrefix="ui-scale-quick"
          />
        </div>
      </HelpBadge>

      <ExplanationDialog
        open={explaining}
        onOpenChange={setExplaining}
        title={t('ui-scale-explanation:title')}
        testId="ui-scale-explanation"
        sections={[
          {
            title: t('ui-scale-explanation:what-title'),
            body: t('ui-scale-explanation:what'),
          },
          {
            title: t('ui-scale-explanation:revert-title'),
            body: t('ui-scale-explanation:revert'),
          },
          {
            title: t('ui-scale-explanation:device-title'),
            body: t('ui-scale-explanation:device'),
          },
        ]}
      />
    </>
  )
}
