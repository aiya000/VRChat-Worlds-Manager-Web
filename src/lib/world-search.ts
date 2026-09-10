import { toRomaji } from 'wanakana'
import type { WorldDisplayData } from '@/lib/types'

/**
 * Name and author, matched the way the collection's search box matches them:
 * case-folded, and again through romaji so a world written in kana answers to
 * a romaji spelling typed on a keyboard that has no kana on it.
 */
export function matchesTextQuery(
  world: Pick<WorldDisplayData, 'name' | 'authorName'>,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase()
  if (needle === '') {
    return true
  }
  return [world.name, world.authorName].some(
    (field) =>
      field.toLowerCase().includes(needle) ||
      toRomaji(field).toLowerCase().includes(needle),
  )
}

/**
 * A world's tags arrive under three spellings and a filter may be written in
 * any of them: VRChat's own are stored as `author_tag_<name>`, a tag added
 * here as `custom:<name>`, and everything else verbatim. Asking for all three
 * means a tag picked from one screen's list still finds worlds on another.
 */
function hasTag(present: Set<string>, filter: string): boolean {
  const tag = filter.trim().toLowerCase()
  return (
    present.has(tag) ||
    present.has(`author_tag_${tag}`) ||
    present.has(`custom:${tag}`)
  )
}

function tagSet(worldTags: string[]): Set<string> {
  return new Set(worldTags.map((tag) => tag.toLowerCase()))
}

/** Every filter has to be on the world, not merely one of them. */
export function matchesTagFilters(
  worldTags: string[],
  filters: string[],
): boolean {
  if (filters.length === 0) {
    return true
  }
  if (worldTags.length === 0) {
    return false
  }
  const present = tagSet(worldTags)
  return filters.every((filter) => hasTag(present, filter))
}

/** Whether any of these tags is on the world, which is what excluding asks. */
export function hasAnyTag(worldTags: string[], filters: string[]): boolean {
  if (filters.length === 0 || worldTags.length === 0) {
    return false
  }
  const present = tagSet(worldTags)
  return filters.some((filter) => hasTag(present, filter))
}
