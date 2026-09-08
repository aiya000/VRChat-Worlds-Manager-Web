import { WorldCardPreview } from '@/components/world-card'
import { useState } from 'react'
import { FolderType } from '@/types/folders'
import { CardSize, WorldDisplayData } from '@/lib/commands'
import { useLocalization } from '@/hooks/use-localization'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
  ContextMenuSeparator,
} from '@/components/ui/context-menu'
import { Square, Check, Plus, Share2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import * as Portal from '@radix-ui/react-portal'
import { Badge } from '@/components/ui/badge'
import { useWorldGrid } from './hook'
import { DraggableWorld } from '../world-drag'

interface WorldGridProps {
  worlds: WorldDisplayData[]
  // Used for virtualized scrolling
  containerRef: React.RefObject<HTMLDivElement | null>
  currentFolder: FolderType
  // Optional interaction flags for special embeds (e.g., selection-only dialog)
  disableCardClick?: boolean
  alwaysShowSelection?: boolean
}

export function WorldGrid({
  worlds,
  containerRef,
  currentFolder,
  disableCardClick = false,
  alwaysShowSelection = false,
}: WorldGridProps) {
  const { t } = useLocalization()

  const {
    cardSize,
    fieldVisibility,
    selectedWorlds,
    selectAllWorlds: _selectAllWorlds,
    toggleWorld,
    clearSelection: _clearSelection,
    isSelectionMode,
    selectAllFindPage: _selectAllFindPage,
    handleOpenFolderDialog,
    handleOpenWorldDetails,
    handleShareWorld,
    handleDeleteWorld: _handleDeleteWorld,
    handleRemoveFromCurrentFolder,
    removeWorldsFromFolder,
    handleHideWorld,
    handleRestoreWorld,
    isFindPage,
    isSpecialFolder,
    isHiddenFolder,
    existingWorldIds,
  } = useWorldGrid(currentFolder, worlds)

  // Worlds found on the search page are not in the collection yet, and hidden
  // ones are meant to be restored first; both keep the popup as their way in.
  const canDragToFolder = !disableCardClick && !isFindPage && !isHiddenFolder

  const gap = 16
  const cardWidths: Record<CardSize, number> = {
    Compact: 192, // w-48 = 12rem = 192px
    Normal: 208, // w-52 = 13rem = 208px
    Expanded: 256, // w-64 = 16rem = 256px
    Original: 256, // w-64 = 16rem = 256px
  }
  const cardW = cardWidths[cardSize]

  // Use CSS Grid auto-fill for responsive layout - no manual calculation needed

  const [dialogConfig, setDialogConfig] = useState<{
    type: 'remove' | 'hide'
    worldId: string
    worldName?: string
    isOpen: boolean
  } | null>(null)

  const handleDialogClose = () => {
    setDialogConfig((prev) => (prev ? { ...prev, isOpen: false } : null))
    setTimeout(() => setDialogConfig(null), 150)
  }

  const handleSelect = (worldId: string, event: React.MouseEvent) => {
    event.preventDefault()
    event.stopPropagation()

    toggleWorld(worldId)
  }

  return (
    <div
      ref={containerRef}
      className="pt-2 flex-1 overflow-auto p-4 justify-items-center"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${cardW}px, 1fr))`,
        gap: `${gap}px`,
        justifyContent: 'center',
      }}
    >
      {worlds.map((world) => {
        const isSelected = selectedWorlds.includes(world.worldId)
        return (
          <ContextMenu key={world.worldId}>
            <ContextMenuTrigger asChild>
              <div
                id={world.worldId}
                onClick={() => {
                  if (disableCardClick) {
                    return
                  }
                  if (isFindPage) {
                    // Only set dontSaveToLocal on worlds not already in collection
                    handleOpenWorldDetails(
                      world.worldId,
                      !existingWorldIds.has(world.worldId),
                    )
                  } else {
                    // dontSaveToLocal defaults to false when omitted
                    handleOpenWorldDetails(world.worldId)
                  }
                }}
                className="group relative w-fit h-fit rounded-lg overflow-hidden"
              >
                {isSelected && (
                  <div className="absolute inset-0 rounded-lg border-2 border-primary pointer-events-none z-10" />
                )}
                <DraggableWorld world={world} enabled={canDragToFolder}>
                  <WorldCardPreview
                    size={cardSize}
                    world={world}
                    fieldVisibility={fieldVisibility}
                  />
                </DraggableWorld>
                <div className="absolute bottom-[70px] left-2 z-10">
                  {isFindPage && existingWorldIds.has(world.worldId) && (
                    <Badge className="bg-green-100 text-green-700 border-green-300 hover:bg-green-100 hover:border-green-300 cursor-default">
                      {t('world-grid:exists-in-collection')}
                    </Badge>
                  )}
                </div>
                {(isSelectionMode || alwaysShowSelection) && (
                  // The card stays the size it is at any scale; the box on it
                  // is the one thing on a card that is pressed, so it grows
                  // with the other controls.
                  <div className="ui-control absolute top-2 left-2 z-10 flex items-center gap-2">
                    <div
                      className="relative w-12 h-12 flex items-center justify-center cursor-pointer"
                      data-testid="world-select-box"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleSelect(world.worldId, e)
                      }}
                    >
                      {/* The thumbnail behind this box can be any colour, so an
                          outline on its own disappears against a busy one. Give
                          the box an opaque backing in both states. */}
                      <div className="absolute h-8 w-8 rounded bg-background ring-1 ring-foreground/40 shadow-sm" />
                      <Square
                        className={`relative w-7 h-7 ${isSelected ? 'text-primary' : 'text-foreground'}`}
                      />
                      {isSelected && (
                        <Check className="absolute inset-0 m-auto w-5 h-5 text-primary" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              {isFindPage ? (
                <>
                  <ContextMenuItem
                    onSelect={(_e) => {
                      handleOpenFolderDialog(world.worldId)
                    }}
                  >
                    {t('world-grid:add-title')}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={(_e) => {
                      handleShareWorld(world.worldId, world.name)
                    }}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    {t('world-grid:share-world')}
                  </ContextMenuItem>
                </>
              ) : !isHiddenFolder ? (
                <>
                  <ContextMenuItem
                    onSelect={(_e) => {
                      handleOpenFolderDialog(world.worldId)
                    }}
                  >
                    {t('world-grid:move-title')}
                  </ContextMenuItem>
                  {!isSpecialFolder && (
                    <ContextMenuItem
                      onSelect={(_e) => {
                        handleRemoveFromCurrentFolder(world.worldId)
                      }}
                      className="text-destructive"
                    >
                      {t('world-grid:remove-title')}
                    </ContextMenuItem>
                  )}
                  <ContextMenuItem
                    onSelect={(_e) => {
                      const worldsToHide =
                        selectedWorlds.length > 0 &&
                        selectedWorlds.includes(world.worldId)
                          ? Array.from(selectedWorlds)
                          : [world.worldId]
                      const worldNames = worldsToHide
                        .map(
                          (id) =>
                            worlds.find((w) => w.worldId === id)?.name || '',
                        )
                        .filter(Boolean)
                      handleHideWorld(worldsToHide, worldNames)
                    }}
                    className="text-destructive"
                  >
                    {t('general:hide-title')}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={(_e) => {
                      handleShareWorld(world.worldId, world.name)
                    }}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    {t('world-grid:share-world')}
                  </ContextMenuItem>
                </>
              ) : (
                <>
                  <ContextMenuItem
                    onSelect={(_e) => {
                      const worldsToRestore =
                        selectedWorlds.length > 0 &&
                        selectedWorlds.includes(world.worldId)
                          ? Array.from(selectedWorlds)
                          : [world.worldId]
                      handleRestoreWorld?.(worldsToRestore)
                    }}
                  >
                    {t('world-grid:restore-world')}
                  </ContextMenuItem>
                  <ContextMenuSeparator />
                  <ContextMenuItem
                    onSelect={(_e) => {
                      handleShareWorld(world.worldId, world.name)
                    }}
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    {t('world-grid:share-world')}
                  </ContextMenuItem>
                </>
              )}
            </ContextMenuContent>
          </ContextMenu>
        )
      })}

      {/* Portaled AlertDialogs */}
      <Portal.Root>
        {dialogConfig && (
          <AlertDialog
            open={dialogConfig.isOpen}
            onOpenChange={(open) => {
              if (!open) {
                handleDialogClose()
              }
            }}
          >
            <AlertDialogContent onEscapeKeyDown={handleDialogClose}>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {dialogConfig.type === 'remove'
                    ? t('world-grid:remove-title')
                    : t('general:hide-title')}
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  {dialogConfig.type === 'remove' ? (
                    <p>{t('world-grid:remove-description')}</p>
                  ) : (
                    <>
                      <p>{t('world-grid:hide-description')}</p>
                      <p className="text-muted-foreground">
                        {t('world-grid:hide-note')}
                      </p>
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={handleDialogClose}>
                  {t('general:cancel')}
                </AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={() => {
                    if (dialogConfig.type === 'remove') {
                      removeWorldsFromFolder([dialogConfig.worldId])
                    } else if (dialogConfig.worldName) {
                      handleHideWorld?.(
                        [dialogConfig.worldId],
                        [dialogConfig.worldName],
                      )
                    }
                    handleDialogClose()
                  }}
                >
                  {dialogConfig.type === 'remove'
                    ? t('world-grid:remove-button')
                    : t('general:hide-title')}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </Portal.Root>

      {isFindPage && selectedWorlds.length > 0 && (
        <div
          className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex justify-center pointer-events-none w-full"
          // Offset is controlled by CSS variable to avoid hardcoding sidebar width
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
              onClick={() => handleOpenFolderDialog(selectedWorlds[0])}
            >
              <Plus className="w-5 h-5" />
              <span className="text-md font-semibold">
                {t('world-grid:add-multiple', selectedWorlds.length)}
              </span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
