import type { Platform } from '@/lib/types'

/**
 * What a platform checkbox asks for. `unknown` is not one of VRChat's
 * platforms -- it stands for a world whose platforms could not be read at all,
 * so it can only be answered from data already in hand.
 */
export type PlatformFilter = 'standalonewindows' | 'android' | 'ios' | 'unknown'

/** The platforms VRChat's `/worlds` can actually be asked about. */
export type SearchablePlatform = Exclude<PlatformFilter, 'unknown'>

export const searchablePlatforms: SearchablePlatform[] = [
  'standalonewindows',
  'android',
  'ios',
]

export const platformFilterOptions: PlatformFilter[] = [
  ...searchablePlatforms,
  'unknown',
]

/**
 * Checking several boxes asks for a world that supports all of them, not any
 * of them: someone looking for Android worlds has no reason to tick PC as
 * well, so ticking both means both were wanted. Checking nothing asks for
 * everything.
 */
export function matchesPlatformFilters(
  platforms: Platform[],
  filters: PlatformFilter[],
): boolean {
  if (filters.length === 0) {
    return true
  }
  return filters.every((filter) =>
    filter === 'unknown'
      ? hasUnknownPlatform(platforms)
      : platforms.includes(filter),
  )
}

/**
 * A world VRChat described in terms this app does not know, or did not
 * describe at all. `parsePlatforms()` produces the first as
 * `['unknownplatform']` and the second as `[]`.
 */
function hasUnknownPlatform(platforms: Platform[]): boolean {
  return platforms.length === 0 || platforms.includes('unknownplatform')
}

/**
 * VRChat's `/worlds` takes one `platform` value and no more. A comma-separated
 * pair, or the parameter twice, answers `200` with an empty list rather than an
 * error -- it goes looking for a platform of that literal name and finds none --
 * so there is no AND on their side and the rest has to be finished here.
 *
 * Send the narrowest of the chosen platforms, then filter the page that comes
 * back. Measured against `sort=popularity&n=50`, `ios` answered with 50 worlds
 * that all supported PC and Android too, `android` with 50 that all supported
 * PC, and `standalonewindows` with the same page as no filter at all.
 */
export function narrowestSearchPlatform(
  filters: SearchablePlatform[],
): SearchablePlatform | null {
  const narrowestFirst: SearchablePlatform[] = [
    'ios',
    'android',
    'standalonewindows',
  ]
  return narrowestFirst.find((platform) => filters.includes(platform)) ?? null
}
