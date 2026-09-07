import { toast } from 'sonner'
import { commands } from '@/lib/commands'
import type { Platform } from '@/lib/types'

type Translate = (key: string, ...args: (string | number)[]) => string

/**
 * Opens an instance in VRChat and says what happened when that needs words.
 *
 * The three places with an "open in VRChat" button -- the toast after making
 * an instance, twice, and every saved instance -- all end here, so each case
 * is worded once. On a desktop nothing needs saying: the client opens or it
 * does not, in its own window.
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
  switch (result.data.kind) {
    case 'not-on-android':
      toast(t('world-detail:not-on-android'))
      return
    case 'android-app':
      // The invite is the way in that is known to work, so whether it went
      // is the thing worth saying; the intent either switched apps already
      // or did nothing visible.
      toast(
        result.data.invited
          ? t('world-detail:android-invite-sent')
          : t('world-detail:android-invite-failed'),
      )
      return
    case 'client':
      return
  }
}
