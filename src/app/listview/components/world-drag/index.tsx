'use client'

import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  useDndContext,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { toast } from 'sonner'
import type { ReactNode } from 'react'
import { useLocalization } from '@/hooks/use-localization'
import { commands, type WorldDisplayData } from '@/lib/commands'
import { refreshViews } from '@/lib/services/refresh-views'

/**
 * Dragging a world card onto a folder in the sidebar puts it in that folder.
 *
 * Mouse only, on purpose. A phone keeps the sidebar in a drawer that a drag
 * cannot open, and a VR laser is not steady enough for this, so both keep the
 * "add to folder" popup as their way in. The distance before a drag starts is
 * what keeps a plain click opening the card as it always has.
 */

interface WorldDragData {
  world: WorldDisplayData
}

interface FolderDropData {
  folderName: string
}

const FOLDER_DROP_PREFIX = 'folder:'

export function WorldDragProvider({ children }: { children: ReactNode }) {
  const { t } = useLocalization()
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
  )

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    const dragged = active.data.current as WorldDragData | undefined
    const target = over?.data.current as FolderDropData | undefined
    if (dragged === undefined || target === undefined) {
      return
    }
    const { world } = dragged
    const { folderName } = target

    // Asked of the database rather than read off the card: the card's copy
    // is as old as its last render, and a drop a moment ago may have changed it.
    const membership = await commands.getFoldersForWorld(world.worldId)
    if (membership.status === 'ok' && membership.data.includes(folderName)) {
      toast(t('world-drag:already-in-folder', world.name, folderName))
      return
    }

    const result = await commands.addWorldToFolder(folderName, world.worldId)
    if (result.status === 'error') {
      console.error(`Failed to add world to folder by drag: ${result.error}`)
      toast(t('general:error-title'), {
        description: t('listview-page:error-add-world'),
      })
      return
    }
    toast(t('listview-page:worlds-added-title'), {
      description: t('world-drag:added-to-folder', world.name, folderName),
      duration: 2000,
    })
    await refreshViews()
  }

  return (
    // By the pointer, not by the rectangle in the air: the chip that travels
    // with the pointer is small and offset from it, and a folder row is what
    // the pointer is over.
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragEnd={handleDragEnd}
    >
      {children}
      <DragOverlay dropAnimation={null}>
        <DraggedWorldChip />
      </DragOverlay>
    </DndContext>
  )
}

/** What travels with the pointer: enough of the card to know which one it is. */
function DraggedWorldChip() {
  const { active } = useDndContext()
  const dragged = active?.data.current as WorldDragData | undefined
  if (dragged === undefined) {
    return null
  }
  const { world } = dragged
  return (
    <div
      data-testid="dragged-world"
      className="flex max-w-64 cursor-grabbing items-center gap-2 rounded-md border bg-background px-2 py-1 shadow-lg"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={world.thumbnailUrl}
        alt=""
        className="h-8 w-12 flex-shrink-0 rounded object-cover"
        draggable="false"
      />
      <span className="truncate text-sm font-medium">{world.name}</span>
    </div>
  )
}

/** Wraps a card so it can be picked up. Does nothing when `enabled` is false. */
export function DraggableWorld({
  world,
  enabled,
  children,
}: {
  world: WorldDisplayData
  enabled: boolean
  children: ReactNode
}) {
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: world.worldId,
    data: { world } satisfies WorldDragData,
    disabled: !enabled,
  })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      data-world-drag={enabled ? 'enabled' : undefined}
      className={isDragging ? 'opacity-50' : undefined}
    >
      {children}
    </div>
  )
}

/** Wraps a sidebar folder row so a card can be dropped on it. */
export function FolderDropTarget({
  folderName,
  children,
}: {
  folderName: string
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${FOLDER_DROP_PREFIX}${folderName}`,
    data: { folderName } satisfies FolderDropData,
  })
  return (
    <div
      ref={setNodeRef}
      data-drop-over={isOver ? 'true' : undefined}
      className={
        isOver
          ? 'rounded-lg ring-2 ring-primary ring-inset bg-primary/10'
          : undefined
      }
    >
      {children}
    </div>
  )
}

/** Whether a world is being dragged right now, for the sidebar to light up. */
export function useIsWorldDragActive(): boolean {
  const { active } = useDndContext()
  return active !== null && active.data.current !== undefined
}
