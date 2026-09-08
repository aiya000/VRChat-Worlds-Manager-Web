'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useLocalization } from '@/hooks/use-localization'
import { useFolders } from '../../hook/use-folders'
import type { FolderData } from '@/lib/commands'

/**
 * Dragging a folder in the sidebar has always worked, but nothing said so and
 * a drag is not something a VR laser pointer or a thumb can carry out anyway.
 * This page does the same job with plain buttons.
 */
export default function ReorderFoldersPage() {
  const { t } = useLocalization()
  const { folders, isLoading, moveFolder } = useFolders()
  const [order, setOrder] = useState<FolderData[]>(folders)

  useEffect(() => {
    setOrder(folders)
  }, [folders])

  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction
    if (destination < 0 || destination >= order.length) {
      return
    }
    // Move locally first: the buttons should answer the press immediately, and
    // the stored order is rewritten from scratch either way.
    const next = [...order]
    const [moved] = next.splice(index, 1)
    next.splice(destination, 0, moved)
    setOrder(next)
    moveFolder(moved.name, destination)
  }

  return (
    <div className="ui-control container max-w-2xl mx-auto p-6 space-y-6">
      <div className="sticky top-0 z-20 -mx-6 flex items-center gap-2 bg-background px-6 py-2">
        <SidebarTrigger className="h-10 w-10 shrink-0" />
        <h1 className="text-2xl font-bold">
          {t('reorder-folders-page:title')}
        </h1>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">
          {t('reorder-folders-page:description')}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('reorder-folders-page:drag-hint')}
        </p>
      </div>

      {!isLoading && order.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t('reorder-folders-page:empty')}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {order.map((folder, index) => (
            <li
              key={folder.name}
              className="flex items-center gap-2 rounded-lg border border-border/60 p-2"
            >
              <span className="w-12 shrink-0 text-right font-mono text-xs text-muted-foreground">
                ({folder.world_count})
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {folder.name}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                title={t('reorder-folders-page:move-up')}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp className="h-4 w-4" />
                <span className="sr-only">
                  {t('reorder-folders-page:move-up')}
                </span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                title={t('reorder-folders-page:move-down')}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown className="h-4 w-4" />
                <span className="sr-only">
                  {t('reorder-folders-page:move-down')}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
