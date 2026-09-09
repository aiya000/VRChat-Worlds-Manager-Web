import { DoorOpen } from 'lucide-react'
import { useLocalization } from '@/hooks/use-localization'
import type { CardSize } from '@/lib/types'

// Sized with the thumbnail it sits on: a compact card's is 85px tall and an
// expanded card's twice that, and one size of mark is either lost on the one
// or covering the other.
const sizeClasses: Record<CardSize, { ring: string; icon: string }> = {
  Compact: { ring: 'h-5 w-5', icon: 'h-3 w-3' },
  Normal: { ring: 'h-6 w-6', icon: 'h-4 w-4' },
  Expanded: { ring: 'h-7 w-7', icon: 'h-4 w-4' },
  Original: { ring: 'h-7 w-7', icon: 'h-4 w-4' },
}

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
export function KeptForInstanceMark({ size }: { size: CardSize }) {
  const { t } = useLocalization()
  const label = t('world-grid:kept-for-instance')
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-testid="kept-for-instance-mark"
      className={`inline-flex items-center justify-center rounded-full border border-amber-300 bg-amber-100 text-amber-700 shadow-sm ${sizeClasses[size].ring}`}
    >
      <DoorOpen className={sizeClasses[size].icon} aria-hidden="true" />
    </span>
  )
}
