import { useLocalization } from '@/hooks/use-localization'
import { commands } from '@/lib/commands'
import { InstanceRegion } from '@/lib/commands'
import type { Platform } from '@/lib/types'
import { GroupInstanceType, InstanceType } from '@/types/instances'
import { toast } from 'sonner'
import { useWorldFiltersStore } from '@/app/listview/hook/use-filters'
import { UserGroup, GroupInstancePermissionInfo } from '@/lib/commands'
import { openInClient } from './open-in-client'

export function useWorldDetailsActions(
  onOpenChange: (open: boolean) => void,
  onInstanceRecorded?: () => void,
) {
  const { t } = useLocalization()
  const { setAuthorFilter, setTagFilters } = useWorldFiltersStore()

  /**
   * `platforms` is what the world was built for, or `null` when not known;
   * it is what decides whether an Android phone can be handed the app.
   */
  const createInstance = async (
    worldId: string,
    instanceType: Exclude<InstanceType, 'group'>,
    region: InstanceRegion,
    platforms: Platform[] | null,
  ) => {
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
      onInstanceRecorded?.()
      toast(t('general:success-title'), {
        description: t('listview-page:created-instance', instanceType),
        action: {
          label: t('listview-page:open-in-client'),
          onClick: async () => {
            try {
              await openInClient(info.world_id, info.instance_id, platforms, t)
            } catch (e) {
              console.error(`Failed to open instance in client: ${e}`)
            }
          },
        },
      })
    } catch (e) {
      console.error(`Failed to create instance: ${e}`)
      toast(t('general:error-title'), {
        description: t('listview-page:error-create-instance'),
      })
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
      onInstanceRecorded?.()
      toast(t('general:success-title'), {
        description: t('listview-page:created-instance', instanceType),
        action: {
          label: t('listview-page:open-in-client'),
          onClick: async () => {
            try {
              await openInClient(info.world_id, info.instance_id, platforms, t)
            } catch (e) {
              console.error(`Failed to open instance in client: ${e}`)
            }
          },
        },
      })
    } catch (e) {
      console.error(`Failed to create group instance: ${e}`)
      toast(t('general:error-title'), {
        description: t('listview-page:error-create-group-instance'),
      })
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
    getGroups,
    getGroupPermissions,
    deleteWorld,
    selectAuthor,
    selectTag,
  }
}
