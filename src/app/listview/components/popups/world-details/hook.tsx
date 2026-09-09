import { useState } from 'react'
import { useLocalization } from '@/hooks/use-localization'
import { commands } from '@/lib/commands'
import { InstanceRegion } from '@/lib/commands'
import { isAndroidBrowser } from '@/lib/launch-target'
import type { InstanceInfo, Platform, WorldDisplayData } from '@/lib/types'
import { GroupInstanceType, InstanceType } from '@/types/instances'
import { toast } from 'sonner'
import { useWorldFiltersStore } from '@/app/listview/hook/use-filters'
import { UserGroup, GroupInstancePermissionInfo } from '@/lib/commands'
import { openInClient } from './open-in-client'

type Translate = ReturnType<typeof useLocalization>['t']

/**
 * The "open in VRChat" button on the toast that says an instance was made --
 * or nothing, on Android.
 *
 * On Android no link opens the app, into an instance or at all: the launcher
 * intent did nothing from Chrome either (see `launchTargetFor`). The invite
 * has just been sent, and the saved instance below the form can send it
 * again, so a button here would only promise what the phone cannot do.
 */
function openInClientToastAction(
  info: InstanceInfo,
  platforms: Platform[] | null,
  t: Translate,
): { label: string; onClick: () => void } | undefined {
  if (isAndroidBrowser(navigator.userAgent)) {
    return undefined
  }
  return {
    label: t('listview-page:open-in-client'),
    onClick: async () => {
      try {
        await openInClient(info.world_id, info.instance_id, platforms, t)
      } catch (e) {
        console.error(`Failed to open instance in client: ${e}`)
      }
    },
  }
}

export function useWorldDetailsActions(
  onOpenChange: (open: boolean) => void,
  onInstanceRecorded?: () => void,
  /**
   * The world as it is known when an instance is made, to be kept alongside
   * it. A function, like `onInstanceRecorded` above, because what it reads is
   * declared after this hook is called and is not known until VRChat answers;
   * it returns `null` while there is nothing to keep.
   */
  worldToKeep?: () => WorldDisplayData | null,
) {
  const { t } = useLocalization()
  const { setAuthorFilter, setTagFilters } = useWorldFiltersStore()
  // VRChat takes a few seconds to make an instance, and the button used to
  // sit there as if nothing had been pressed.
  const [isCreatingInstance, setIsCreatingInstance] = useState(false)

  /**
   * `platforms` is what the world was built for, or `null` when not known;
   * it is what decides whether an Android phone can be handed the app.
   */
  /**
   * Sends the invite that gets you into an instance you just made, and says
   * how the toast should read.
   *
   * VRChat's own website sends one when it makes an instance; this app only
   * ever sent it from the "open in VRChat" button, on Android, which is why an
   * instance made here could look created and be unreachable from the app
   * (#115). Someone who does not want the notification can turn it off.
   */
  const inviteMyselfIfWanted = async (
    worldId: string,
    instanceId: string,
  ): Promise<boolean> => {
    const skip = await commands.getSkipSelfInviteOnCreate()
    if (skip.status === 'ok' && skip.data) {
      return false
    }
    const invited = await commands.inviteMyselfToInstance(worldId, instanceId)
    if (invited.status === 'error') {
      console.error(`Failed to invite myself: ${invited.error}`)
      return false
    }
    return invited.data
  }

  /**
   * Keeps a copy of the world, because an instance of it has just been made.
   *
   * An instance can be entered from its two ids alone, but only by someone who
   * can still reach it, and the only way there is the world's own detail popup
   * -- which needs the world to be in the collection. A world opened from
   * "find" is deliberately not saved (`dontSaveToLocal`), so without this an
   * instance made there is recorded under a world that is nowhere, and once
   * VRChat stops serving that world -- the author makes it private -- there is
   * no way back to it at all. The instance outlives the world; the copy is what
   * lets it be found.
   *
   * `rememberWorld` leaves an existing `dateAdded` alone, so a world already in
   * the collection is untouched but for its details being refreshed.
   */
  const keepTheWorld = async () => {
    const world = worldToKeep?.() ?? null
    if (world === null) {
      return
    }
    const kept = await commands.rememberWorld(world)
    if (kept.status === 'error') {
      // Not worth a toast of its own: the instance was made and recorded,
      // which is what the press asked for.
      console.error(`Failed to keep the world: ${kept.error}`)
    }
  }

  const createInstance = async (
    worldId: string,
    instanceType: Exclude<InstanceType, 'group'>,
    region: InstanceRegion,
    platforms: Platform[] | null,
  ) => {
    setIsCreatingInstance(true)
    try {
      const result = await commands.createWorldInstance(
        worldId,
        instanceType,
        region,
      )
      if (result.status === 'error') {
        toast(t('general:error-title'), { description: result.error })
        return
      }
      const info = result.data
      // Remembering it here rather than when the toast's button is pressed:
      // the toast goes away on its own, and it used to be the only place a
      // launch URL existed.
      const remembered = await commands.recordLaunchedInstance({
        worldId: info.world_id,
        instanceId: info.instance_id,
        shortName: info.short_name,
        instanceType,
        region,
      })
      if (remembered.status === 'error') {
        console.error(`Failed to remember instance: ${remembered.error}`)
      }
      await keepTheWorld()
      onInstanceRecorded?.()
      const invited = await inviteMyselfIfWanted(
        info.world_id,
        info.instance_id,
      )
      toast(t('general:success-title'), {
        description: invited
          ? `${t('listview-page:created-instance', instanceType)}\n${t('world-detail:android-invite-sent')}`
          : t('listview-page:created-instance', instanceType),
        action: openInClientToastAction(info, platforms, t),
      })
    } catch (e) {
      console.error(`Failed to create instance: ${e}`)
      toast(t('general:error-title'), {
        description: t('listview-page:error-create-instance'),
      })
    } finally {
      setIsCreatingInstance(false)
    }
  }

  const createGroupInstance = async (
    worldId: string,
    region: InstanceRegion,
    id: string,
    instanceType: GroupInstanceType,
    queueEnabled: boolean,
    platforms: Platform[] | null,
    selectedRoles?: string[],
  ) => {
    setIsCreatingInstance(true)
    try {
      const result = await commands.createGroupInstance(
        worldId,
        id,
        instanceType,
        selectedRoles ?? null,
        region,
        queueEnabled,
      )
      if (result.status === 'error') {
        toast(t('general:error-title'), { description: result.error })
        return
      }
      const info = result.data
      // Remembering it here rather than when the toast's button is pressed:
      // the toast goes away on its own, and it used to be the only place a
      // launch URL existed.
      const remembered = await commands.recordLaunchedInstance({
        worldId: info.world_id,
        instanceId: info.instance_id,
        shortName: info.short_name,
        instanceType,
        region,
      })
      if (remembered.status === 'error') {
        console.error(`Failed to remember instance: ${remembered.error}`)
      }
      await keepTheWorld()
      onInstanceRecorded?.()
      const invited = await inviteMyselfIfWanted(
        info.world_id,
        info.instance_id,
      )
      toast(t('general:success-title'), {
        description: invited
          ? `${t('listview-page:created-instance', instanceType)}\n${t('world-detail:android-invite-sent')}`
          : t('listview-page:created-instance', instanceType),
        action: openInClientToastAction(info, platforms, t),
      })
    } catch (e) {
      console.error(`Failed to create group instance: ${e}`)
      toast(t('general:error-title'), {
        description: t('listview-page:error-create-group-instance'),
      })
    } finally {
      setIsCreatingInstance(false)
    }
  }

  const getGroups = async (): Promise<UserGroup[]> => {
    try {
      const result = await commands.getUserGroups()
      if (result.status === 'error') {
        throw new Error(result.error)
      }
      return result.data
    } catch (e) {
      console.error(`Failed to get groups: ${e}`)
      toast(t('general:error-title'), {
        description: t('listview-page:error-get-groups'),
      })
      return []
    }
  }

  const getGroupPermissions = async (
    id: string,
  ): Promise<GroupInstancePermissionInfo> => {
    try {
      const result = await commands.getPermissionForCreateGroupInstance(id)
      if (result.status === 'error') {
        throw new Error(result.error)
      }
      return result.data
    } catch (e) {
      console.error(`Failed to get group permissions: ${e}`)
      toast(t('general:error-title'), {
        description: t('listview-page:error-get-group-permissions'),
      })
      throw new Error('Group permissions not found')
    }
  }

  const deleteWorld = async (worldId: string) => {
    try {
      const res = await commands.deleteWorld(worldId)
      if (res.status === 'error') {
        toast(t('general:error-title'), {
          description: t('listview-page:error-delete-world'),
        })
        return
      }
      toast(t('general:success-title'), {
        description: t('listview-page:world-deleted-success'),
      })
      onOpenChange(false)
    } catch (e) {
      console.error(`Failed to delete world: ${e}`)
      toast(t('general:error-title'), {
        description: t('listview-page:error-delete-world'),
      })
    }
  }

  const hideWorld = async (worldId: string, worldName: string) => {
    try {
      const res = await commands.hideWorld(worldId)
      if (res.status === 'error') {
        toast(t('general:error-title'), {
          description: t('listview-page:error-hide-world'),
        })
        return
      }
      toast(t('listview-page:worlds-hidden-title'), {
        description: t('listview-page:worlds-hidden-single', worldName),
      })
      onOpenChange(false)
    } catch (e) {
      console.error(`Failed to hide world: ${e}`)
      toast(t('general:error-title'), {
        description: t('listview-page:error-hide-world'),
      })
    }
  }

  const selectAuthor = (author: string) => {
    setAuthorFilter(author)
    onOpenChange(false)
  }

  const selectTag = (tag: string) => {
    setTagFilters([tag])
    onOpenChange(false)
  }

  return {
    createInstance,
    createGroupInstance,
    isCreatingInstance,
    getGroups,
    getGroupPermissions,
    deleteWorld,
    hideWorld,
    selectAuthor,
    selectTag,
  }
}
