'use client'

import { Lock } from 'lucide-react'
import type { FC } from 'react'
import { Badge } from '@/components/ui/badge'
import { useLocalization } from '@/hooks/use-localization'
import type { WorldReleaseStatus } from '@/lib/types'

/**
 * Says that VRChat is not publishing this world.
 *
 * Only `private` is marked. `unknown` -- a world saved before the status was
 * kept, or one VRChat would not describe at all -- says nothing: a guess here
 * would be read as a fact about someone's world, and the world detail already
 * has its own notice for a world VRChat refused.
 */
export const WorldReleaseStatusBadge: FC<{
  status: WorldReleaseStatus
}> = ({ status }) => {
  const { t } = useLocalization()

  if (status !== 'private') {
    return null
  }

  return (
    <Badge
      variant="secondary"
      className="gap-1 shrink-0"
      data-testid="world-private-badge"
    >
      <Lock className="h-3 w-3" aria-hidden />
      {t('world-detail:private-world')}
    </Badge>
  )
}
