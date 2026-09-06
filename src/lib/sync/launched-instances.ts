import type { LaunchedInstanceSyncRecord } from './types'

/**
 * How many instances of one world are kept.
 *
 * An old instance is usually closed, so keeping several is what makes it
 * likely that one of them still opens. Keeping all of them forever would turn
 * the world detail into a log, which is the wrong thing to hand someone
 * reading it through a VR overlay.
 */
export const LAUNCHED_INSTANCES_PER_WORLD = 10

/** The id a row is stored under. A launch URL is built from the same pair. */
export function launchedInstanceId(
  worldId: string,
  instanceId: string,
): string {
  return `${worldId}:${instanceId}`
}

/**
 * The URL that hands an instance to the VRChat client.
 *
 * This is the whole reason a row is worth keeping: it is built from the two ids
 * and needs nothing from VRChat's API.
 */
export function launchUrlFor(worldId: string, instanceId: string): string {
  return `vrchat://launch?ref=vrchat.com&id=${launchedInstanceId(worldId, instanceId)}`
}

type Ordered = Pick<LaunchedInstanceSyncRecord, 'id' | 'launchedAt'>

/**
 * Newest first, with the id settling ties so two devices showing the same rows
 * show them in the same order.
 */
export function newestFirst<T extends Ordered>(instances: T[]): T[] {
  return [...instances].sort((a, b) => {
    if (a.launchedAt !== b.launchedAt) {
      return b.launchedAt - a.launchedAt
    }
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/**
 * The rows past the limit, which is what pruning removes. Returned rather than
 * removed here so the caller decides how -- they are tombstoned, not deleted,
 * or another device would hand them straight back on the next merge.
 */
export function beyondTheLimit<T extends Ordered>(
  instances: T[],
  limit: number = LAUNCHED_INSTANCES_PER_WORLD,
): T[] {
  return newestFirst(instances).slice(limit)
}

/**
 * The label the rest of the world detail already uses for an instance type,
 * so a saved instance is not the one place on the screen speaking VRChat's
 * own vocabulary. `null` for anything without one -- a group instance's
 * `group+`, or a type VRChat adds later -- which is shown as it was stored.
 */
export function instanceTypeLabelKey(instanceType: string): string | null {
  switch (instanceType) {
    case 'public':
      return 'world-detail:public'
    case 'friends+':
      return 'world-detail:friends-plus'
    case 'friends':
      return 'world-detail:friends'
    case 'invite+':
      return 'world-detail:invite-plus'
    case 'invite':
      return 'world-detail:invite'
    case 'group':
      return 'world-detail:group'
    default:
      return null
  }
}

/** How a region is spelled on the buttons that pick one. */
export function regionLabel(region: string): string {
  switch (region) {
    case 'us':
      return 'USW'
    case 'use':
      return 'USE'
    case 'eu':
      return 'EU'
    case 'jp':
      return 'JP'
    default:
      return region.toUpperCase()
  }
}
