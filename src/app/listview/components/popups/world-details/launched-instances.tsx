'use client'

import { ExternalLink, Trash2 } from 'lucide-react'
import { useEffect, useState, type FC } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useLocalization } from '@/hooks/use-localization'
import { commands } from '@/lib/commands'
import type { LaunchedInstanceRecord } from '@/lib/services/db'
import {
  instanceTypeLabelKey,
  regionLabel,
} from '@/lib/sync/launched-instances'
import type { Platform } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import { openInClient } from './open-in-client'

type Props = {
  worldId: string
  /** Bumped by the caller when an instance has just been made. */
  reloadKey?: number
  /** What the world was built for, when known. A row here does not carry it. */
  platforms?: Platform[] | null
}

/**
 * The instances that were made for this world, so one of them can be entered
 * again.
 *
 * The launch URL is built from the ids alone and asks VRChat's API for nothing,
 * so a row here keeps working on its own.
 */
export const LaunchedInstances: FC<Props> = ({
  worldId,
  reloadKey = 0,
  platforms = null,
}) => {
  const { t, language } = useLocalization()
  const [instances, setInstances] = useState<LaunchedInstanceRecord[]>([])

  useEffect(() => {
    const load = async () => {
      const result = await commands.getLaunchedInstances(worldId)
      if (result.status === 'error') {
        console.error(`Failed to load instances: ${result.error}`)
        return
      }
      setInstances(result.data)
    }

    load()
  }, [worldId, reloadKey])

  const open = (instance: LaunchedInstanceRecord) =>
    openInClient(instance.worldId, instance.instanceId, platforms, t)

  const forget = async (instance: LaunchedInstanceRecord) => {
    const result = await commands.forgetLaunchedInstance(instance.id)
    if (result.status === 'error') {
      toast(t('general:error-title'), { description: result.error })
      return
    }
    setInstances((rows) => rows.filter((row) => row.id !== instance.id))
  }

  const typeLabel = (instanceType: string): string => {
    const key = instanceTypeLabelKey(instanceType)
    return key === null ? instanceType : t(key)
  }

  if (instances.length === 0) {
    return null
  }

  return (
    <div
      role="group"
      aria-label={t('world-detail:saved-instances')}
      className="mt-4 pt-4 border-t border-border"
    >
      <p className="font-medium mb-1 text-sm">
        {t('world-detail:saved-instances')}
      </p>
      <p className="text-xs text-muted-foreground mb-3">
        {t('world-detail:saved-instances-description')}
      </p>
      <div className="flex flex-col gap-2">
        {instances.map((instance) => (
          <div key={instance.id} className="flex items-center gap-2">
            {/* Tall and full width: this is aimed at with a VR controller's
                laser as often as with a mouse. */}
            <Button
              variant="outline"
              className="h-auto min-h-12 flex-1 justify-start gap-2 py-2 text-left"
              onClick={() => open(instance)}
            >
              <ExternalLink className="h-4 w-4 shrink-0" />
              <span className="flex flex-col items-start">
                <span className="text-sm font-medium">
                  {typeLabel(instance.instanceType)} ·{' '}
                  {regionLabel(instance.region)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(
                    new Date(instance.launchedAt).toISOString(),
                    language,
                  )}
                </span>
              </span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-12 w-12 shrink-0"
              onClick={() => forget(instance)}
              aria-label={t('world-detail:forget-instance')}
              title={t('world-detail:forget-instance')}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
