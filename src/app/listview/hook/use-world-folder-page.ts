import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { useLocalization } from '@/hooks/use-localization'
import { useFolders } from './use-folders'
import { usePopupStore } from './usePopups/store'
import { useWorldFilters } from './use-filters'
import { useSelectedWorldsStore } from './use-selected-worlds'
import { useWorlds } from './use-worlds'
import { usePresetWorlds } from './use-preset-worlds'
import { commands, WorldDisplayData } from '@/lib/commands'
import { toast } from 'sonner'

export type UseWorldFolderPageOptions = {
  folderId: string
  showPreReloadToast?: boolean
  reloadLogScope?: string
}

export type UseWorldFolderPageResult = {
  t: ReturnType<typeof useLocalization>['t']
  gridScrollRef: RefObject<HTMLDivElement>
  worlds: WorldDisplayData[]
  filteredWorlds: WorldDisplayData[]
  isLoading: boolean
  selectedWorlds: string[]
  visibleSelectedWorlds: string[]
  allSelected: boolean
  handleSelectAll: () => void
  handleReload: () => Promise<void>
  openAddWorld: () => void
  openMoveSelected: () => void
  isSelectionMode: boolean
  isSeedingPresets: boolean
  isPresetNoticeOpen: boolean
  dismissPresetNotice: () => void
}

export const useWorldFolderPage = (
  options: UseWorldFolderPageOptions,
): UseWorldFolderPageResult => {
  const {
    folderId,
    showPreReloadToast = false,
    reloadLogScope = folderId,
  } = options

  const gridScrollRef = useRef<HTMLDivElement>(null!)
  const { t } = useLocalization()
  const { refresh: refreshFolders } = useFolders()
  const { worlds, refresh, isLoading } = useWorlds(folderId)
  // Whichever folder page is opened first is the one that seeds: the preset
  // worlds go in unfiled, so they are in "all" and "unclassified" either way.
  const {
    isSeeding: isSeedingPresets,
    isNoticeOpen: isPresetNoticeOpen,
    dismissNotice: dismissPresetNotice,
  } = usePresetWorlds()
  const { filteredWorlds } = useWorldFilters(worlds)
  const setPopup = usePopupStore((s) => s.setPopup)
  const {
    getSelectedWorlds,
    isSelectionMode,
    selectAllWorlds: _selectAllWorlds,
    setSelection,
    clearFolderSelections,
  } = useSelectedWorldsStore()

  const selectedWorlds = Array.from(getSelectedWorlds(folderId))
  const selectedWorldIdSet = new Set(selectedWorlds)
  const filteredWorldIds = filteredWorlds.map((w) => w.worldId)
  const visibleSelectedWorlds = filteredWorldIds.filter((id) =>
    selectedWorldIdSet.has(id),
  )
  const visibleSelectedWorldIdSet = new Set(visibleSelectedWorlds)

  const allSelected =
    filteredWorlds.length > 0 &&
    visibleSelectedWorlds.length === filteredWorlds.length

  const handleSelectAll = () => {
    if (allSelected) {
      clearFolderSelections(folderId)
    } else {
      const worldIds = filteredWorlds.map((world) => world.worldId)
      setSelection(folderId, worldIds)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault()
        setPopup('showAddWorld', true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setPopup])

  const handleReload = async () => {
    try {
      if (showPreReloadToast) {
        toast.info(t('listview-page:reloading-worlds'), { duration: 5000 })
      }

      const favs = await commands.getFavoriteWorlds()
      if (favs.status === 'error') {
        toast(t('general:error-title'), { description: favs.error })
        return
      }

      await refresh()
      await refreshFolders()
      toast(t('general:success-title'), {
        description: t('listview-page:worlds-fetched'),
      })
    } catch (e) {
      console.error(`[${reloadLogScope}] reload failed: ${e}`)
      toast.error(t('general:error-title'), {
        description: t('listview-page:error-refresh-worlds'),
      })
    }
  }

  const openAddWorld = () => setPopup('showAddWorld', true)
  const openMoveSelected = () =>
    setPopup(
      'showAddToFolder',
      worlds.filter((w) => visibleSelectedWorldIdSet.has(w.worldId)),
    )

  return {
    t,
    gridScrollRef,
    worlds,
    filteredWorlds,
    isLoading,
    selectedWorlds,
    visibleSelectedWorlds,
    allSelected,
    handleSelectAll,
    handleReload,
    openAddWorld,
    openMoveSelected,
    isSelectionMode,
    isSeedingPresets,
    isPresetNoticeOpen,
    dismissPresetNotice,
  }
}
