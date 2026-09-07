import React from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DriveSyncButton } from './drive-sync-button'
import { SearchBar } from './searchbar'
import { UiScaleControl } from './ui-scale-control'
import { WorldGrid } from './world-grid'
import { WorldGridSkeleton } from './world-grid/skeleton'
import { useWorldFolderPage } from '../hook/use-world-folder-page'
import { WorldDisplayData } from '@/lib/commands'

type RenderActionsArgs = {
  openAddWorld: () => void
  handleReload: () => Promise<void>
  isLoading: boolean
  worlds: WorldDisplayData[]
  filteredWorlds: WorldDisplayData[]
}

type WorldFolderPageProps = {
  folderId: string
  title: string
  emptyAllMessage: string
  emptyFilteredMessage: string
  renderActions?: (args: RenderActionsArgs) => React.ReactNode
  showPreReloadToast?: boolean
  reloadLogScope?: string
}

export function WorldFolderPage(props: WorldFolderPageProps) {
  const {
    folderId,
    title,
    emptyAllMessage,
    emptyFilteredMessage,
    renderActions,
    showPreReloadToast,
    reloadLogScope,
  } = props

  const {
    t,
    gridScrollRef,
    worlds,
    filteredWorlds,
    isLoading,
    visibleSelectedWorlds,
    allSelected,
    handleSelectAll,
    handleReload,
    openAddWorld,
    openMoveSelected,
    isSelectionMode,
  } = useWorldFolderPage({
    folderId,
    showPreReloadToast,
    reloadLogScope,
  })

  return (
    <div className="flex h-full">
      <div ref={gridScrollRef} className="flex-1 flex flex-col overflow-auto">
        <div className="p-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h1 className="text-xl font-bold truncate">{title}</h1>
          </div>
          {/* `justify-end`: on a phone these wrap onto a second line, and a
              button that wrapped should sit under the right edge of the row
              above rather than start a new left margin of its own. */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {isSelectionMode && filteredWorlds.length > 0 && (
              <Button
                variant="outline"
                onClick={handleSelectAll}
                className="flex items-center gap-2 cursor-pointer"
              >
                <span>
                  {allSelected
                    ? t('general:clear-all')
                    : t('general:select-all')}
                </span>
              </Button>
            )}
            {renderActions?.({
              openAddWorld,
              handleReload,
              isLoading,
              worlds,
              filteredWorlds,
            })}
            {/* Beside the button that fetches from VRChat: the two are the
                actions that reach outside this device, and they read as a
                pair. Syncing is a press now (#124), and the press has to be
                reachable from where the worlds are rather than from the
                settings screen. */}
            <DriveSyncButton />
            {/* Last in the row, and on every folder page: the scale is what
                the reader reaches for when the interface has grown too large
                to navigate, so it may not live behind navigation. */}
            <UiScaleControl />
          </div>
        </div>
        <div>
          <SearchBar currentFolder={folderId} />
          <div className="flex-1">
            {isLoading && worlds.length === 0 ? (
              <WorldGridSkeleton />
            ) : filteredWorlds.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                {worlds.length === 0 ? emptyAllMessage : emptyFilteredMessage}
              </div>
            ) : (
              <WorldGrid
                worlds={filteredWorlds}
                currentFolder={folderId}
                containerRef={gridScrollRef}
              />
            )}
          </div>
        </div>

        {visibleSelectedWorlds.length > 0 && (
          <div
            className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex justify-center pointer-events-none w-full"
            style={{ left: 'calc(50% + var(--sidebar-offset, 0px))' }}
          >
            <div className="pointer-events-auto relative inline-block">
              <div
                className="absolute inset-0 rounded-lg bg-background"
                style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                aria-hidden="true"
              />
              <Button
                variant="default"
                size="lg"
                className="rounded-lg flex items-center gap-2 px-4 py-3 relative"
                onClick={openMoveSelected}
              >
                <Plus className="w-5 h-5" />
                <span className="text-md font-semibold">
                  {t('world-grid:move-multiple', visibleSelectedWorlds.length)}
                </span>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default WorldFolderPage
