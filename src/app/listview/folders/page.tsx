'use client'

import { ArrowUpDown, Folder, MoreHorizontal, Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { useLocalization } from '@/hooks/use-localization'
import { commands, type WorldDisplayData } from '@/lib/commands'
import { useFolders } from '../hook/use-folders'
import { usePopupStore } from '../hook/usePopups/store'

const PREVIEW_COUNT = 4

/**
 * The first few worlds of every folder, keyed by folder name, plus how many
 * worlds sit in no folder at all.
 *
 * One read of every world, grouped here, rather than one read per folder: the
 * page shows every folder at once, and a world can be in several.
 */
function groupPreviews(worlds: WorldDisplayData[]): {
  previews: Map<string, WorldDisplayData[]>
  unclassified: number
} {
  const previews = new Map<string, WorldDisplayData[]>()
  let unclassified = 0
  for (const world of worlds) {
    if (world.folders.length === 0) {
      unclassified += 1
    }
    for (const folder of world.folders) {
      const list = previews.get(folder) ?? []
      if (list.length < PREVIEW_COUNT) {
        list.push(world)
      }
      previews.set(folder, list)
    }
  }
  return { previews, unclassified }
}

/**
 * Every folder as a card, with a glimpse of what is inside.
 *
 * The sidebar shows a folder's name and nothing else; a picture of what it
 * holds is recognisable from further away than a word, which is what a VR
 * overlay and a phone need. Renaming and deleting live behind the card's own
 * menu, where a finger or a laser can reach them -- the sidebar keeps them in
 * a right-click menu.
 */
export default function FoldersPage() {
  const { t } = useLocalization()
  const router = useRouter()
  const setPopup = usePopupStore((state) => state.setPopup)
  const { folders, isLoading, renameFolder } = useFolders()

  const [worlds, setWorlds] = useState<WorldDisplayData[] | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [newName, setNewName] = useState('')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const result = await commands.getAllWorlds()
      if (cancelled) {
        return
      }
      if (result.status === 'error') {
        console.error(
          `Failed to load worlds for folder previews: ${result.error}`,
        )
        setWorlds([])
        return
      }
      setWorlds(result.data)
    }
    load()
    return () => {
      cancelled = true
    }
    // A rename or a delete changes which folder a world reports, so the
    // previews are read again whenever the folder list does.
  }, [folders])

  const { previews, unclassified } = groupPreviews(worlds ?? [])

  const openFolder = (name: string) => {
    router.push(
      `/listview/folders/userFolder?folderName=${encodeURIComponent(name)}`,
    )
  }

  const submitRename = async () => {
    const trimmed = newName.trim()
    if (renaming === null || trimmed === '' || trimmed === renaming) {
      setRenaming(null)
      return
    }
    await renameFolder(renaming, trimmed)
    setRenaming(null)
  }

  return (
    <div className="ui-control container mx-auto max-w-5xl space-y-4 p-4 sm:p-6">
      <div className="sticky top-0 z-20 -mx-4 flex items-center gap-2 bg-background px-4 py-2 sm:-mx-6 sm:px-6">
        <SidebarTrigger className="h-10 w-10 shrink-0" />
        <h1 className="min-w-0 flex-1 truncate text-2xl font-bold">
          {t('folders-page:title')}
        </h1>
        <Button
          variant="outline"
          className="h-10 gap-2"
          onClick={() => setPopup('showCreateFolder', true)}
        >
          <Plus className="h-4 w-4" aria-hidden />
          <span>{t('folders-page:add')}</span>
        </Button>
        {folders.length > 1 && (
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10"
            title={t('app-sidebar:reorder-folders')}
            onClick={() => router.push('/listview/folders/reorder')}
          >
            <ArrowUpDown className="h-4 w-4" aria-hidden />
            <span className="sr-only">{t('app-sidebar:reorder-folders')}</span>
          </Button>
        )}
      </div>

      {worlds !== null && (
        <p
          className="text-sm text-muted-foreground"
          data-testid="folders-summary"
        >
          {t('folders-page:summary', worlds.length, unclassified)}
        </p>
      )}

      {!isLoading && folders.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <Folder className="h-12 w-12 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            {t('folders-page:empty')}
          </p>
          <Button
            className="h-12 gap-2 px-6"
            onClick={() => setPopup('showCreateFolder', true)}
          >
            <Plus className="h-5 w-5" aria-hidden />
            <span>{t('folders-page:add')}</span>
          </Button>
        </div>
      ) : (
        <ul
          className="grid gap-3"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(11rem, 1fr))',
          }}
        >
          {folders.map((folder) => {
            const preview = previews.get(folder.name) ?? []
            return (
              <li
                key={folder.name}
                className="relative overflow-hidden rounded-lg border border-border/60 bg-card"
                data-testid="folder-card"
              >
                <button
                  type="button"
                  className="block w-full text-left"
                  onClick={() => openFolder(folder.name)}
                  aria-label={t('folders-page:open', folder.name)}
                >
                  <FolderPreview worlds={preview} />
                  <div className="flex items-baseline gap-2 p-3 pr-12">
                    <span className="min-w-0 flex-1 truncate text-base font-semibold">
                      {folder.name}
                    </span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      ({folder.world_count})
                    </span>
                  </div>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute bottom-1 right-1 h-10 w-10 rounded-full"
                      aria-label={t('folders-page:menu', folder.name)}
                    >
                      <MoreHorizontal className="h-5 w-5" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => {
                        setRenaming(folder.name)
                        setNewName(folder.name)
                      }}
                    >
                      {t('app-sidebar:rename')}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="cursor-pointer text-destructive"
                      onClick={() => setPopup('showDeleteFolder', folder.name)}
                    >
                      {t('general:delete')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            )
          })}
        </ul>
      )}

      <Dialog
        open={renaming !== null}
        onOpenChange={(open) => {
          if (!open) {
            setRenaming(null)
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('app-sidebar:rename')}</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault()
                submitRename()
              }
            }}
            aria-label={t('folders-page:new-name')}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenaming(null)}>
              {t('general:cancel')}
            </Button>
            <Button onClick={submitRename}>{t('general:save')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Up to four thumbnails in a square: a single one fills it, two or three sit
 * side by side, four make a grid. An empty folder shows the folder itself.
 */
function FolderPreview({ worlds }: { worlds: WorldDisplayData[] }) {
  if (worlds.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center bg-muted/40">
        <Folder className="h-10 w-10 text-muted-foreground" aria-hidden />
      </div>
    )
  }
  const columns = worlds.length === 1 ? 1 : 2
  return (
    <div
      className="grid aspect-square w-full gap-0.5 bg-muted/40"
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {worlds.map((world) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={world.worldId}
          src={world.thumbnailUrl}
          alt=""
          className="h-full w-full min-h-0 object-cover"
          draggable="false"
          loading="lazy"
        />
      ))}
    </div>
  )
}
