import { DoorOpen } from 'lucide-react'
import { useLocalization } from '@/hooks/use-localization'

/**
 * The one mark for a world that is here only because an instance was made in
 * it (#173).
 *
 * The same mark on "all worlds" and on the search page, so there is one thing
 * to learn: on the list it says why a world nobody added is there, and on the
 * search page it stands where "added" would, because a world the list does
 * not show cannot be called added. Drawn at a size a laser can find, with the
 * words behind it for anyone who asks the element what it is.
 */
export function KeptForInstanceMark() {
  const { t } = useLocalization()
  const label = t('world-grid:kept-for-instance')
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-testid="kept-for-instance-mark"
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-amber-700 shadow-sm"
    >
      <DoorOpen className="h-5 w-5" aria-hidden="true" />
    </span>
  )
}
