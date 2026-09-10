'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useLocalization } from '@/hooks/use-localization'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { FetchWorldsButton } from '@/app/listview/components/fetch-worlds-button'
import { Loader2, Search, Square, CheckSquare } from 'lucide-react'
import { commands, WorldDisplayData } from '@/lib/commands'
import { SpecialFolders } from '@/types/folders'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent } from '@/components/ui/card'
import { WorldGrid } from '../../../components/world-grid'
import { WorldGridSkeleton } from '../../../components/world-grid/skeleton'
import MultiFilterItemSelector from '@/components/multi-filter-item-selector'
import { PlatformFilterCheckboxes } from '@/components/platform-filter-checkboxes'
import {
  matchesPlatformFilters,
  searchablePlatforms,
  type SearchablePlatform,
} from '@/lib/platform-filter'
import { useSelectedWorldsStore } from '../../../hook/use-selected-worlds'
import { HelpHint } from '@/components/help-hint'
import { useFolders } from '@/app/listview/hook/use-folders'

// How many of VRChat's pages one press may walk through while looking for
// worlds that survive the platform filter. Without a filter the first page
// always answers, so this only costs requests when one is set.
const MAX_PAGES_PER_SEARCH = 5

export default function FindWorldsPage() {
  const { t } = useLocalization()
  // `t` is a new function on every render, so anything listing it as a
  // dependency is rebuilt on every render too, and every effect that depends
  // on it runs again. The fetch below reads the latest `t` from here instead.
  const tRef = useRef(t)
  tRef.current = t
  const [activeTab, setActiveTab] = useState('recently-visited')
  // `null` until the first answer arrives. An empty answer and "not asked
  // yet" used to be the same value, so the effect that fetches on first load
  // could not tell them apart and asked again as soon as it finished.
  const [recentlyVisitedWorlds, setRecentlyVisitedWorlds] = useState<
    WorldDisplayData[] | null
  >(null)
  const [isLoading, setIsLoading] = useState(false)
  const [searchResults, setSearchResults] = useState<WorldDisplayData[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSort, setSelectedSort] = useState('popularity')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedExcludedTags, setSelectedExcludedTags] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<
    SearchablePlatform[]
  >([])
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreResults, setHasMoreResults] = useState(true)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const findGridRef = useRef<HTMLDivElement>(null)
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

  // Check if all recently visited worlds are selected
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

  const { importFolder } = useFolders()

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // CTRL + R - Reload worlds (only in recently-visited tab)
      if (e.ctrlKey && e.key === 'r' && activeTab === 'recently-visited') {
        e.preventDefault()
        fetchRecentlyVisitedWorlds()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab, fetchRecentlyVisitedWorlds])

  // Check for import parameter in URL query string (web deep-link replacement)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const importId = params.get('import')
    if (importId) {
      console.info(`[DeepLink] Detected import parameter: ${importId}`)
      importFolder(importId)
      // Clean up the URL
      const url = new URL(window.location.href)
      url.searchParams.delete('import')
      window.history.replaceState({}, '', url.toString())
    }
  }, [importFolder])

  // Add this state variable to track if a search has been performed
  const [hasSearched, setHasSearched] = useState(false)

  // Keep selectedSort in sync: when a search query is present, force sort to 'relevance'
  useEffect(() => {
    if (searchQuery.trim() !== '') {
      // Only update when it's not already 'relevance' to avoid unnecessary state updates
      setSelectedSort((prev) => (prev === 'relevance' ? prev : 'relevance'))
    }
  }, [searchQuery])
  const [loadMoreBackoffUntil, setLoadMoreBackoffUntil] = useState<
    number | null
  >(null)

  // Fetch recently visited worlds on initial load, once. Asking whenever the
  // list was empty meant an account with nothing recent fetched forever.
  useEffect(() => {
    if (hasRequestedRecentlyVisitedRef.current) {
      return
    }
    hasRequestedRecentlyVisitedRef.current = true
    fetchRecentlyVisitedWorlds()
  }, [fetchRecentlyVisitedWorlds])

  // Load tags when the search tab is active
  useEffect(() => {
    const loadTags = async () => {
      try {
        const result = await commands.getTagsByCount()
        if (result.status === 'ok') {
          setAvailableTags(result.data)
        }
      } catch (err) {
        console.error(`Failed to load tags: ${err}`)
      }
    }

    if (activeTab === 'search') {
      loadTags()
    }
  }, [activeTab])

  const handleSearch = async (loadMore = false) => {
    // Respect backoff if trying to auto load more
    if (loadMore && loadMoreBackoffUntil && Date.now() < loadMoreBackoffUntil) {
      return
    }

    if (!loadMore) {
      // Only set this flag when performing a new search, not when loading more
      setHasSearched(true)
    }

    if (loadMore) {
      setIsLoadingMore(true)
    } else {
      setIsSearching(true)
      setCurrentPage(1) // Reset page when performing a new search
      setSearchResults([]) // Clear previous results
      setHasMoreResults(true) // Assume there are more results
    }

    try {
      // VRChat is asked about one platform at most -- it answers a
      // comma-separated pair with nothing at all -- so the rest of the AND is
      // finished here. A page can therefore filter down to nothing while the
      // search has plenty left, and an empty grid would stop the infinite
      // scroll from ever asking for the next one, so keep asking for a few
      // pages until there is something to show.
      let page = loadMore ? currentPage + 1 : 1
      let shown: WorldDisplayData[] = []
      let received = 0

      for (let attempt = 0; attempt < MAX_PAGES_PER_SEARCH; attempt++) {
        const result = await commands.searchWorlds(
          selectedSort,
          selectedTags,
          selectedExcludedTags,
          searchQuery,
          page,
          selectedPlatforms,
        )
        if (result.status !== 'ok') {
          throw new Error(result.error)
        }
        received = result.data.length
        shown = result.data.filter((world) =>
          matchesPlatformFilters(world.platform, selectedPlatforms),
        )
        console.info(
          `Search results: page=${page} received=${received} shown=${shown.length}`,
        )
        if (shown.length > 0 || received === 0) {
          break
        }
        page++
      }

      if (loadMore) {
        // Append new results to existing ones
        setSearchResults((prev) => [...prev, ...shown])
        setLoadMoreBackoffUntil(null) // reset backoff after success
      } else {
        // Replace results for new search
        setSearchResults(shown)
      }
      setCurrentPage(page)

      // Whether there is another page is decided by what VRChat sent, not by
      // what survived the filter.
      setHasMoreResults(received > 0)

      if (shown.length === 0 && !loadMore) {
        toast(t('find-page:no-more-results'), {
          description: t('find-page:try-different-search'),
        })
      }
    } catch (err) {
      console.error(`Search error: ${err}`)
      toast(t('find-page:search-error'), {
        description: String(err),
      })

      // Apply a brief backoff and nudge scroll up so the sentinel isn't intersecting
      if (loadMore) {
        const backoffMs = 2500 // 2-3 seconds backoff
        setLoadMoreBackoffUntil(Date.now() + backoffMs)
        console.info(
          `Load-more backoff applied for ${backoffMs}ms; nudging scroll up`,
        )
        const scroller = findGridRef.current
        try {
          if (scroller) {
            scroller.scrollBy({ top: -100, behavior: 'smooth' })
          } else if (typeof window !== 'undefined') {
            window.scrollBy({ top: -100, behavior: 'smooth' })
          }
        } catch (_e) {
          // noop
        }
      }
    } finally {
      setIsLoadingMore(false)
      setIsSearching(false)
    }
  }

  // Add this useEffect to observe when user scrolls to bottom
  useEffect(() => {
    // Only observe if we have results and more results are available
    if (
      !searchResults.length ||
      !hasMoreResults ||
      isLoadingMore ||
      isSearching
    ) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        // When the load more indicator comes into view
        if (entries[0].isIntersecting) {
          handleSearch(true)
        }
      },
      { threshold: 0.5 }, // Trigger when element is 50% visible
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [searchResults, hasMoreResults, isLoadingMore, isSearching]) // eslint-disable-line react-hooks/exhaustive-deps

  // no external select-all; handled by grid internally when needed

  return (
    <div className="p-1 flex flex-col h-full min-h-0">
      {/* added min-h-0 */}
      {/* Header with title and reload button */}
      <div className="ui-control flex items-center justify-between p-4 bg-background">
        <h1 className="text-xl font-bold">{t('general:find-worlds')}</h1>

        <div className="flex items-center">
          {isSelectionMode &&
            activeTab === 'recently-visited' &&
            visitedWorlds.length > 0 && (
              <Button
                variant="outline"
                onClick={handleSelectAll}
                className="mr-2 flex items-center gap-2 cursor-pointer"
              >
                <span>
                  {allSelected
                    ? t('general:clear-all')
                    : t('general:select-all')}
                </span>
              </Button>
            )}
          {activeTab === 'recently-visited' && (
            <FetchWorldsButton
              kind="recent"
              onClick={fetchRecentlyVisitedWorlds}
              disabled={isLoading}
              loading={isLoading}
            />
          )}
          <Button
            variant={isSelectionMode ? 'secondary' : 'ghost'}
            size="icon"
            onClick={() => {
              if (isSelectionMode) {
                clearFolderSelections(SpecialFolders.Find)
                toggleSelectionMode()
              } else {
                toggleSelectionMode()
              }
            }}
            className={`ml-2 h-9 w-9 ${
              activeTab !== 'recently-visited' ? 'invisible' : ''
            }`}
          >
            {isSelectionMode ? (
              <CheckSquare className="h-4 w-4" />
            ) : (
              <Square className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Tab bar with full-width tabs */}
      <div className="ui-control bg-background px-4 pb-2">
        <Tabs
          defaultValue="recently-visited"
          value={activeTab}
          onValueChange={setActiveTab}
          className="w-full"
        >
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="recently-visited">
              {t('find-page:recently-visited')}
            </TabsTrigger>
            <TabsTrigger value="search">
              {t('find-page:search-worlds')}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Search and filter controls - moved into the search tab content scroll container below */}

      {/* Main content area */}
      <div>
        {activeTab === 'recently-visited' && (
          <div className="flex flex-col gap-2">
            {isLoading || recentlyVisitedWorlds === null ? (
              <WorldGridSkeleton />
            ) : visitedWorlds.length > 0 ? (
              <WorldGrid
                worlds={visitedWorlds}
                currentFolder={SpecialFolders.Find}
                containerRef={findGridRef}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-64">
                <p className="text-muted-foreground">
                  {t('find-page:no-recently-visited-worlds')}
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="flex-1 min-h-0">
            {/* new scroll container for search tab */}
            <div className="ui-control sticky top-0 z-40 bg-background border-b">
              {/* sticky header now inside scroller */}
              <Card className=" mx-4 border-0 shadow-none">
                <CardContent className="pt-4 space-y-4">
                  {/* First row: Search input, Sort dropdown, and Search button */}
                  <div className="flex gap-4 items-end">
                    {/* Search text input */}
                    <div className="flex flex-col gap-2 w-3/5">
                      <Label htmlFor="search-query">
                        {t('find-page:search-query')}
                      </Label>
                      <Input
                        id="search-query"
                        placeholder={t('find-page:search-placeholder')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>

                    {/* Sort options */}
                    <div className="flex flex-col gap-2 w-2/5">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="sort">{t('find-page:sort-by')}</Label>
                        {searchQuery.trim() !== '' && (
                          <HelpHint
                            label={t('find-page:sort-by')}
                            tooltip={t('find-page:sort-relevant-tooltip')}
                            title={t('find-page:sort-help-title')}
                            sections={[
                              {
                                title: t('find-page:sort-help-what-title'),
                                body: t('find-page:sort-help-what'),
                              },
                              {
                                title: t('find-page:sort-help-why-title'),
                                body: t('find-page:sort-help-why'),
                              },
                            ]}
                            testId="find-sort"
                          />
                        )}
                      </div>
                      <Select
                        value={selectedSort}
                        onValueChange={setSelectedSort}
                        disabled={searchQuery.trim() !== ''}
                      >
                        <SelectTrigger id="sort">
                          <SelectValue
                            placeholder={t('find-page:sort-popularity')}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="popularity">
                            {t('find-page:sort-popularity')}
                          </SelectItem>
                          <SelectItem value="heat">
                            {t('find-page:sort-heat')}
                          </SelectItem>
                          <SelectItem value="random">
                            {t('find-page:sort-random')}
                          </SelectItem>
                          <SelectItem value="favorites">
                            {t('find-page:sort-favorites')}
                          </SelectItem>
                          <SelectItem value="publicationDate">
                            {t('find-page:sort-publication-date')}
                          </SelectItem>
                          <SelectItem value="created">
                            {t('find-page:sort-created')}
                          </SelectItem>
                          <SelectItem value="updated">
                            {t('find-page:sort-updated')}
                          </SelectItem>
                          <SelectItem value="relevance">
                            {t('find-page:sort-relevant')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Second row: Tag filters */}
                  <div className="flex gap-4 items-start">
                    {/* Tag combobox */}
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <Label htmlFor="tag">{t('find-page:tag')}</Label>
                      <MultiFilterItemSelector
                        placeholder={t('find-page:tag-placeholder')}
                        candidates={availableTags.map((tag) => ({
                          value: tag,
                          label: tag,
                        }))}
                        values={selectedTags}
                        onValuesChange={setSelectedTags}
                        allowCustomValues={true}
                        maxItems={5}
                        id="Tag"
                      />
                    </div>

                    {/* Exclude Tag combobox */}
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <Label htmlFor="exclude-tag">
                          {t('find-page:exclude-tag')}
                        </Label>
                        <HelpHint
                          label={t('find-page:exclude-tag')}
                          tooltip={t('find-page:exclude-tag-tooltip')}
                          title={t('find-page:exclude-tag-help-title')}
                          sections={[
                            {
                              title: t('find-page:exclude-tag-help-what-title'),
                              body: t('find-page:exclude-tag-help-what'),
                            },
                            {
                              title: t('find-page:exclude-tag-help-how-title'),
                              body: t('find-page:exclude-tag-help-how'),
                            },
                          ]}
                          testId="find-exclude-tag"
                        />
                      </div>
                      <MultiFilterItemSelector
                        placeholder={t('find-page:exclude-tag-placeholder')}
                        candidates={[...availableTags].reverse().map((tag) => ({
                          value: tag,
                          label: tag,
                        }))}
                        values={selectedExcludedTags}
                        onValuesChange={setSelectedExcludedTags}
                        allowCustomValues={true}
                        maxItems={5}
                        id="ExcludeTag"
                      />
                    </div>
                    {/* Search button */}
                    <div className="flex-1 min-w-0 flex flex-col gap-2">
                      <Label className="invisible">
                        Invisible Label to align the button!
                        {/* <3 ciel-chan */}
                      </Label>
                      <Button
                        className="flex-shrink-0"
                        onClick={() => handleSearch(false)}
                        disabled={isSearching}
                      >
                        {isSearching ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            {t('find-page:searching')}
                          </>
                        ) : (
                          <>
                            <Search className="mr-2 h-4 w-4" />
                            {t('find-page:search-button')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Third row: platform filters. "Unknown" is not offered
                      here -- VRChat has no way to be asked about it. */}
                  <PlatformFilterCheckboxes
                    options={searchablePlatforms}
                    values={selectedPlatforms}
                    onValuesChange={setSelectedPlatforms}
                    idPrefix="find"
                  />
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col gap-4 p-4">
              {/* original search tab content */}
              {/* Search results */}
              {isSearching && searchResults.length === 0 && (
                <WorldGridSkeleton />
              )}

              {searchResults.length > 0 && (
                <div className="flex-1">
                  <WorldGrid
                    worlds={searchResults}
                    currentFolder={SpecialFolders.Find}
                    containerRef={findGridRef}
                  />

                  {/* Load more indicator */}
                  <div ref={loadMoreRef} className="p-4 flex justify-center">
                    {isLoadingMore ? (
                      <div className="w-full max-w-screen-lg">
                        <WorldGridSkeleton count={6} />
                      </div>
                    ) : hasMoreResults ? (
                      <p className="text-sm text-muted-foreground">
                        {t('find-page:scroll-for-more')}
                      </p>
                    ) : (
                      searchResults.length > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {t('find-page:no-more-results')}
                        </p>
                      )
                    )}
                  </div>
                </div>
              )}

              {/* No results state - only show when a search has been performed */}
              {!isSearching && searchResults.length === 0 && hasSearched && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Search className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {t('find-page:no-search-results')}
                  </p>
                </div>
              )}

              {/* Initial state - show either when no search has been performed or when search query is empty */}
              {!isSearching && searchResults.length === 0 && !hasSearched && (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <Search className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    {t('find-page:search-instructions')}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
