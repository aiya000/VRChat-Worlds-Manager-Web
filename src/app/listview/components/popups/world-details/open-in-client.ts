import { toast } from 'sonner'
import { commands } from '@/lib/commands'
import type { Platform } from '@/lib/types'

type Translate = (key: string, ...args: (string | number)[]) => string

/**
 * Opens an instance in VRChat and says so when it cannot.
 *
 * The three places with an "open in VRChat" button -- the toast after making
 * an instance, twice, and every saved instance -- all end here, so the one
 * case that needs words (a world with no Android build, on an Android phone)
 * is worded once.
 */
export async function openInClient(
  worldId: string,
  instanceId: string,
  platforms: Platform[] | null,
  t: Translate,
): Promise<void> {
  const result = await commands.openInstanceInClient(
    worldId,
    instanceId,
    platforms,
  )
  if (result.status === 'error') {
    toast(t('general:error-title'), { description: result.error })
    return
  }
  if (result.data.kind === 'not-on-android') {
    toast(t('world-detail:not-on-android'))
  }
}
