'use client'

import { ArrowDownToLine, LoaderCircle } from 'lucide-react'
import { useState, type FC } from 'react'
import { Button } from '@/components/ui/button'
import { ExplanationDialog } from '@/components/explanation-dialog'
import { HelpBadge } from '@/components/help-badge'
import { useLocalization } from '@/hooks/use-localization'

/**
 * Which list VRChat is being asked for. The words differ, and so does what
 * happens to the answer: favourites are written into the local database,
 * recently visited worlds are only shown.
 */
export type FetchWorldsKind = 'favorites' | 'recent'

/**
 * The button that asks VRChat for a list of worlds.
 *
 * It used to be "Refresh" with the same circling arrows as the sync button,
 * and the two were being mistaken for one another. The arrow pointing down
 * is what it does: pull a list down from VRChat. The "?" says the rest.
 */
export const FetchWorldsButton: FC<{
  kind: FetchWorldsKind
  onClick: () => void
  disabled?: boolean
  loading?: boolean
  className?: string
}> = ({ kind, onClick, disabled, loading, className }) => {
  const { t } = useLocalization()
  const [explaining, setExplaining] = useState(false)

  const prefix = kind === 'favorites' ? 'fetch-favorites' : 'fetch-recent'
  const label = t(`${prefix}:button`)
  const sections =
    kind === 'favorites'
      ? [
          {
            title: t('fetch-favorites:what-title'),
            body: t('fetch-favorites:what'),
          },
          {
            title: t('fetch-favorites:when-title'),
            body: t('fetch-favorites:when'),
          },
          {
            title: t('fetch-favorites:needs-title'),
            body: t('fetch-favorites:needs'),
          },
        ]
      : [
          {
            title: t('fetch-recent:what-title'),
            body: t('fetch-recent:what'),
          },
          {
            title: t('fetch-recent:needs-title'),
            body: t('fetch-recent:needs'),
          },
        ]

  return (
    <>
      <HelpBadge
        tooltip={t(`${prefix}:tooltip`)}
        helpLabel={t('general:help-about', label)}
        onHelp={() => setExplaining(true)}
        helpTestId={`${prefix}-help`}
      >
        <Button
          variant="outline"
          className={`flex items-center gap-2 ${className ?? ''}`}
          onClick={onClick}
          disabled={disabled}
        >
          {loading ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <ArrowDownToLine className="h-4 w-4" aria-hidden />
          )}
          <span>{label}</span>
        </Button>
      </HelpBadge>
      <ExplanationDialog
        open={explaining}
        onOpenChange={setExplaining}
        title={t(`${prefix}:title`)}
        sections={sections}
        testId={`${prefix}-explanation`}
      />
    </>
  )
}
