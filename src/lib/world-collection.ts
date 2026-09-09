import type { WorldDetails, WorldDisplayData } from './types'
import { isKeptForInstance } from './sync/types'

/**
 * What VRChat answered, in the shape the collection keeps.
 *
 * The two differ in three ways, and each is a decision rather than an
 * oversight:
 *
 * - the fields VRChat serves that a list has no use for -- `authorId`,
 *   `description`, `recommendedCapacity`, `publicationDate`, `releaseStatus`
 *   -- are dropped. `worldDetails` is where those are kept
 * - `folders` starts empty. Filing a world somewhere is a separate act from
 *   having it
 * - `dateAdded` is this moment, because this is the moment the collection
 *   first had the world
 *
 * That last one is only true of a world that is new here, which is why the
 * result belongs in `rememberWorld` rather than `putWorld`: it keeps the
 * `dateAdded` already on record, so adding a world again does not restamp it.
 */
export function worldForCollection(details: WorldDetails): WorldDisplayData {
  return {
    worldId: details.worldId,
    name: details.name,
    thumbnailUrl: details.thumbnailUrl,
    authorName: details.authorName,
    favorites: details.favorites,
    lastUpdated: details.lastUpdated,
    visits: details.visits,
    dateAdded: new Date().toISOString(),
    platform: details.platform,
    folders: [],
    tags: details.tags,
    capacity: details.capacity,
  }
}

/**
 * The worlds a screen listing the collection shows.
 *
 * A world kept only because an instance was made in it is left out unless
 * asked for: nobody added it, and to someone looking at "all worlds" a list
 * that grows on its own is a list whose meaning changed (#173). The row stays
 * either way -- the instance is reached through it -- which is why this sits
 * with the screens and not with `getAllWorlds`: the private-world fallback and
 * the "added" badge read that too, and both need the row to be found.
 */
export function shownInCollection(
  worlds: WorldDisplayData[],
  showKeptForInstance: boolean,
): WorldDisplayData[] {
  if (showKeptForInstance) {
    return worlds
  }
  return worlds.filter((world) => !isKeptForInstance(world))
}
