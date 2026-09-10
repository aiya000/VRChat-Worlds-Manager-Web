'use client'

import { useEffect, useState, useRef } from 'react'
import { useLocalization } from '@/hooks/use-localization'
import { Button } from '@/components/ui/button'
import { Loader2, Search } from 'lucide-react'
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
import { WorldGrid } from '../components/world-grid'
import { WorldGridSkeleton } from '../components/world-grid/skeleton'
import MultiFilterItemSelector from '@/components/multi-filter-item-selector'
import { PlatformFilterCheckboxes } from '@/components/platform-filter-checkboxes'
import { Checkbox } from '@/components/ui/checkbox'
import {
  matchesPlatformFilters,
  searchablePlatforms,
  type SearchablePlatform,
} from '@/lib/platform-filter'
import {
  hasAnyTag,
  matchesTagFilters,
  matchesTextQuery,
} from '@/lib/world-search'
import { shownInCollection } from '@/lib/world-collection'
import {
  getDefaultDirection,
  type SortField,
} from '@/app/listview/hook/use-filters'
import { HelpHint } from '@/components/help-hint'
import { SidebarTrigger } from '@/components/ui/sidebar'

// How many of VRChat's pages one press may walk through while looking for
// worlds that survive the platform filter. Without a filter the first page
// always answers, so this only costs requests when one is set.
const MAX_PAGES_PER_SEARCH = 5

export default function SearchWorldsPage() {
  const { t } = useLocalization()
  const [searchResults, setSearchResults] = useState<WorldDisplayData[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSort, setSelectedSort] = useState('popularity')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedExcludedTags, setSelectedExcludedTags] = useState<string[]>([])
  const [selectedPlatforms, setSelectedPlatforms] = useState<
    SearchablePlatform[]
  >([])
  // Looking through the collection instead of VRChat. The two can be ordered
  // by different things -- popularity and heat are VRChat's own and are not
  // kept here -- so each keeps its own chosen order rather than sharing one
  // that only half of them can honour.
  const [searchSavedOnly, setSearchSavedOnly] = useState(false)
  const [selectedSavedSort, setSelectedSavedSort] =
    useState<SortField>('dateAdded')
  const [availableTags, setAvailableTags] = useState<string[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMoreResults, setHasMoreResults] = useState(true)
  const [hasSearched, setHasSearched] = useState(false)
  const [loadMoreBackoffUntil, setLoadMoreBackoffUntil] = useState<
    number | null
  >(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const searchGridRef = useRef<HTMLDivElement>(null)

  // Keep selectedSort in sync: when a search query is present, force sort to
  // 'relevance'. Only VRChat decides relevance, so the collection's own order
  // is left alone.
  useEffect(() => {
    if (searchSavedOnly) {
      return
    }
    if (searchQuery.trim() !== '') {
      // Only update when it's not already 'relevance' to avoid unnecessary state updates
      setSelectedSort((prev) => (prev === 'relevance' ? prev : 'relevance'))
    }
  }, [searchQuery, searchSavedOnly])

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

    loadTags()
  }, [])

  /**
   * The collection answers in one go -- it is already here, and it is a few
   * hundred worlds rather than VRChat's catalogue -- so there is no next page
   * to scroll for.
   */
  const searchSavedWorlds = async (): Promise<WorldDisplayData[]> => {
    const stored = await commands.getAllWorlds()
    if (stored.status !== 'ok') {
      throw new Error(stored.error)
    }
    const show = await commands.getShowWorldsKeptForInstance()
    const collection = shownInCollection(
      stored.data,
      show.status === 'ok' && show.data,
    )
    const found = collection.filter(
      (world) =>
        matchesTextQuery(world, searchQuery) &&
        matchesTagFilters(world.tags ?? [], selectedTags) &&
        !hasAnyTag(world.tags ?? [], selectedExcludedTags) &&
        matchesPlatformFilters(world.platform, selectedPlatforms),
    )
    const sorted = await commands.sortWorldsDisplay(
      found,
      selectedSavedSort,
      getDefaultDirection(selectedSavedSort),
    )
    return sorted.status === 'ok' ? sorted.data : found
  }

  const handleSearch = async (loadMore = false) => {
    // Respect backoff if trying to auto load more
    if (loadMore && loadMoreBackoffUntil && Date.now() < loadMoreBackoffUntil) {
      return
    }

    // There is nothing further to load out of the collection.
    if (searchSavedOnly && loadMore) {
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
      if (searchSavedOnly) {
        const found = await searchSavedWorlds()
        console.info(`Searched the collection: ${found.length} worlds found`)
        setSearchResults(found)
        setCurrentPage(1)
        setHasMoreResults(false)
        if (found.length === 0) {
          toast(t('find-page:no-more-results'), {
            description: t('find-page:try-different-search'),
          })
        }
        return
      }

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
        const scroller = searchGridRef.current
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

  return (
    <div className="p-1 flex flex-col h-full min-h-0">
      <div className="ui-control flex items-center justify-between gap-2 p-4 bg-background">
        {/* The sidebar collapses at every width, so a page without this
            button is a page a phone cannot leave: the drawer is the only way
            back to the folders. */}
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="h-10 w-10 shrink-0" />
          <h1 className="truncate text-xl font-bold">
            {t('general:search-worlds')}
          </h1>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <div className="ui-control sticky top-0 z-40 bg-background border-b">
          <Card className=" mx-4 border-0 shadow-none">
            <CardContent className="pt-4 space-y-4">
              {/* Where to look. It decides what every control below
                  means, so it reads before them. */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="search-saved-only"
                    checked={searchSavedOnly}
                    onCheckedChange={(checked) => setSearchSavedOnly(!!checked)}
                  />
                  <label
                    htmlFor="search-saved-only"
                    className="text-sm cursor-pointer py-1"
                  >
                    {t('find-page:saved-only')}
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('find-page:saved-only-hint')}
                </p>
              </div>

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
                    {searchQuery.trim() !== '' && !searchSavedOnly && (
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
                  {/* Popularity, heat and the publication dates are
                      VRChat's own and are not kept here, so searching the
                      collection offers what the collection can answer. */}
                  {searchSavedOnly ? (
                    <Select
                      value={selectedSavedSort}
                      onValueChange={(value) =>
                        setSelectedSavedSort(value as SortField)
                      }
                    >
                      <SelectTrigger id="sort">
                        <SelectValue
                          placeholder={t('world-grid:sort-placeholder')}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="dateAdded">
                          {t('general:date-added')}
                        </SelectItem>
                        <SelectItem value="name">
                          {t('world-grid:sort-name')}
                        </SelectItem>
                        <SelectItem value="authorName">
                          {t('general:author')}
                        </SelectItem>
                        <SelectItem value="visits">
                          {t('world-grid:sort-visits')}
                        </SelectItem>
                        <SelectItem value="favorites">
                          {t('world-grid:sort-favorites')}
                        </SelectItem>
                        <SelectItem value="capacity">
                          {t('world-grid:sort-capacity')}
                        </SelectItem>
                        <SelectItem value="lastUpdated">
                          {t('world-grid:sort-last-updated')}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
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
                  )}
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
          {/* Search results */}
          {isSearching && searchResults.length === 0 && <WorldGridSkeleton />}

          {searchResults.length > 0 && (
            <div className="flex-1">
              <WorldGrid
                worlds={searchResults}
                currentFolder={SpecialFolders.Find}
                containerRef={searchGridRef}
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
    </div>
  )
}
