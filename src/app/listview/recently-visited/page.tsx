'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocalization } from '@/hooks/use-localization'
import { Button } from '@/components/ui/button'
import { FetchWorldsButton } from '@/app/listview/components/fetch-worlds-button'
import { Square, CheckSquare } from 'lucide-react'
import { commands, WorldDisplayData } from '@/lib/commands'
import { SpecialFolders } from '@/types/folders'
import { toast } from 'sonner'
import { WorldGrid } from '../components/world-grid'
import { WorldGridSkeleton } from '../components/world-grid/skeleton'
import { useSelectedWorldsStore } from '../hook/use-selected-worlds'
import { SidebarTrigger } from '@/components/ui/sidebar'

export default function RecentlyVisitedWorldsPage() {
  const { t } = useLocalization()
  // `t` is a new function on every render, so anything listing it as a
  // dependency is rebuilt on every render too, and every effect that depends
  // on it runs again. The fetch below reads the latest `t` from here instead.
  const tRef = useRef(t)
  tRef.current = t
  // `null` until the first answer arrives. An empty answer and "not asked
  // yet" used to be the same value, so the effect that fetches on first load
  // could not tell them apart and asked again as soon as it finished.
  const [recentlyVisitedWorlds, setRecentlyVisitedWorlds] = useState<
    WorldDisplayData[] | null
  >(null)
  const [isLoading, setIsLoading] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const hasRequestedRecentlyVisitedRef = useRef(false)
  const {
    isSelectionMode,
    toggleSelectionMode,
    clearFolderSelections,
    selectAllWorlds,
    getSelectedWorlds,
  } = useSelectedWorldsStore()

  const visitedWorlds = recentlyVisitedWorlds ?? []
  const selectedWorlds = Array.from(getSelectedWorlds(SpecialFolders.Find))
  const selectedWorldIdSet = new Set(selectedWorlds)

  const allSelected =
    visitedWorlds.length > 0 &&
    selectedWorlds.length === visitedWorlds.length &&
    visitedWorlds.every((world) => selectedWorldIdSet.has(world.worldId))

  const handleSelectAll = () => {
    if (allSelected) {
      clearFolderSelections(SpecialFolders.Find)
    } else {
      const worldIds = visitedWorlds.map((world) => world.worldId)
      selectAllWorlds(SpecialFolders.Find, worldIds)
    }
  }

  const fetchRecentlyVisitedWorlds = useCallback(async () => {
    try {
      setIsLoading(true)
      const worlds = await commands.getRecentlyVisitedWorlds()
      if (worlds.status !== 'ok') {
        throw new Error(worlds.error)
      } else {
        console.info(`Fetched recently visited worlds: ${worlds.data.length}`)
        setRecentlyVisitedWorlds(worlds.data)
      }
      toast(tRef.current('find-page:fetch-recently-visited-worlds'), {
        description: tRef.current(
          'find-page:fetch-recently-visited-worlds-success',
          worlds.data.length,
        ),
        duration: 1000,
      })
    } catch (err) {
      console.error(`Error fetching recently visited worlds: ${String(err)}`)
      // The page is no longer waiting for an answer, whatever went wrong.
      setRecentlyVisitedWorlds((current) => current ?? [])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'r') {
        e.preventDefault()
        fetchRecentlyVisitedWorlds()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [fetchRecentlyVisitedWorlds])

  // Fetch recently visited worlds on initial load, once. Asking whenever the
  // list was empty meant an account with nothing recent fetched forever.
  useEffect(() => {
    if (hasRequestedRecentlyVisitedRef.current) {
      return
    }
    hasRequestedRecentlyVisitedRef.current = true
    fetchRecentlyVisitedWorlds()
  }, [fetchRecentlyVisitedWorlds])

  return (
    <div className="p-1 flex flex-col h-full min-h-0">
      <div className="ui-control flex items-center justify-between gap-2 p-4 bg-background">
        {/* The sidebar collapses at every width, so a page without this
            button is a page a phone cannot leave: the drawer is the only way
            back to the folders. */}
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="h-10 w-10 shrink-0" />
          <h1 className="truncate text-xl font-bold">
            {t('find-page:recently-visited')}
          </h1>
        </div>

        <div className="flex items-center">
          {isSelectionMode && visitedWorlds.length > 0 && (
            <Button
              variant="outline"
              onClick={handleSelectAll}
              className="mr-2 flex items-center gap-2 cursor-pointer"
            >
              <span>
                {allSelected ? t('general:clear-all') : t('general:select-all')}
              </span>
            </Button>
          )}
          <FetchWorldsButton
            kind="recent"
            onClick={fetchRecentlyVisitedWorlds}
            disabled={isLoading}
            loading={isLoading}
          />
          <Button
            variant={isSelectionMode ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => {
              if (isSelectionMode) {
                clearFolderSelections(SpecialFolders.Find)
              }
              toggleSelectionMode()
            }}
            className="ml-2 h-9 w-9"
          >
            {isSelectionMode ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div>
        <div className="flex flex-col gap-2">
          {isLoading || recentlyVisitedWorlds === null ? (
            <WorldGridSkeleton />
          ) : visitedWorlds.length > 0 ? (
            <WorldGrid
              worlds={visitedWorlds}
              currentFolder={SpecialFolders.Find}
              containerRef={gridRef}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-64">
              <p className="text-muted-foreground">
                {t('find-page:no-recently-visited-worlds')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
