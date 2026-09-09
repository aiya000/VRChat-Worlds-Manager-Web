import { Context, Effect, Layer } from 'effect'
import type { WorldDisplayData, WorldDetails } from '@/lib/types'
import { isKeptForInstance } from '@/lib/sync/types'
import { db, isActive, isMember, type WorldRecord } from './db'
import {
  activeFolderByName,
  activeFolders,
  folderNamesById,
  folderNamesOf,
  folderRefFor,
  memberFolderIds,
  tombstoned,
  touched,
  withMember,
  withoutMember,
} from './sync-meta'

export class WorldService extends Context.Tag('WorldService')<
  WorldService,
  {
    readonly getAllWorlds: () => Effect.Effect<WorldDisplayData[], Error>
    readonly getWorlds: (
      folderName: string,
    ) => Effect.Effect<WorldDisplayData[], Error>
    readonly getUnclassifiedWorlds: () => Effect.Effect<
      WorldDisplayData[],
      Error
    >
    readonly getHiddenWorlds: () => Effect.Effect<WorldDisplayData[], Error>
    readonly deleteWorld: (worldId: string) => Effect.Effect<void, Error>
    readonly hideWorld: (worldId: string) => Effect.Effect<void, Error>
    readonly unhideWorld: (worldId: string) => Effect.Effect<void, Error>
    readonly addWorldToFolder: (
      folderName: string,
      worldId: string,
    ) => Effect.Effect<void, Error>
    readonly removeWorldFromFolder: (
      folderName: string,
      worldId: string,
    ) => Effect.Effect<void, Error>
    readonly getWorld: (
      worldId: string,
      dontSaveToLocal: boolean | null,
    ) => Effect.Effect<WorldDetails, Error>
    readonly putWorld: (world: WorldDisplayData) => Effect.Effect<void, Error>
    /**
     * Puts the world in the collection, keeping the date it first appeared if
     * it is already there.
     */
    readonly rememberWorld: (
      world: WorldDisplayData,
    ) => Effect.Effect<void, Error>
    readonly putWorldDetails: (
      world: WorldDetails,
    ) => Effect.Effect<void, Error>
    readonly sortWorldsDisplay: (
      worlds: WorldDisplayData[],
      sortField: string,
      sortDirection: string,
    ) => Effect.Effect<WorldDisplayData[]>
  }
>() {}

function toDisplayData(
  record: WorldRecord,
  folderNameById: Map<string, string>,
): WorldDisplayData {
  return {
    worldId: record.worldId,
    name: record.name,
    thumbnailUrl: record.thumbnailUrl,
    authorName: record.authorName,
    favorites: record.favorites,
    lastUpdated: record.lastUpdated,
    visits: record.visits,
    dateAdded: record.dateAdded,
    platform: record.platform,
    folders: folderNamesOf(record, folderNameById),
    tags: record.tags,
    capacity: record.capacity,
    ...(isKeptForInstance(record) ? { keptForInstance: true } : {}),
  }
}

async function hiddenWorldIds(): Promise<Set<string>> {
  const rows = await db.hiddenWorlds.toArray()
  return new Set(rows.filter(isActive).map((row) => row.worldId))
}

async function readWorlds(
  keep: (world: WorldRecord, folderNameById: Map<string, string>) => boolean,
): Promise<WorldDisplayData[]> {
  const folderNameById = folderNamesById(await activeFolders())
  const worlds = await db.worlds.toArray()
  return worlds
    .filter(isActive)
    .filter((world) => keep(world, folderNameById))
    .map((world) => toDisplayData(world, folderNameById))
}

/**
 * Writes the world row the list reads, keeping the folder memberships it
 * already had.
 */
async function writeWorld(world: WorldDisplayData): Promise<void> {
  const existing = await db.worlds.get(world.worldId)
  const folders = await activeFolders()
  const idByName = new Map(folders.map((folder) => [folder.name, folder.id]))
  const now = Date.now()

  // Refreshing from VRChat must not decide folder membership. A name the
  // caller passes that is not a member yet is added; memberships it does
  // not mention are left exactly as they are, because taking one away is
  // `removeWorldFromFolder`'s job and nothing else's.
  let folderRefs = existing?.folderRefs ?? []
  for (const name of world.folders) {
    const folderId = idByName.get(name)
    if (folderId === undefined) {
      continue
    }
    const alreadyAMember = folderRefs.some(
      (ref) => ref.folderId === folderId && isMember(ref),
    )
    if (alreadyAMember) {
      continue
    }
    folderRefs = withMember(
      folderRefs,
      (ref) => ref.folderId === folderId,
      (addedAt) => folderRefFor(folderId, addedAt),
      now,
    )
  }

  // Being asked for is the claim that sticks: a world kept for an instance
  // and later added by hand was added, and a world added by hand that an
  // instance is then made in was still added. The flag survives a write only
  // when both the row and the caller say it is held for an instance alone.
  const keptForInstance =
    isKeptForInstance(world) &&
    (existing === undefined || isKeptForInstance(existing))

  await db.worlds.put({
    ...(await touched()),
    worldId: world.worldId,
    name: world.name,
    thumbnailUrl: world.thumbnailUrl,
    authorName: world.authorName,
    favorites: world.favorites,
    lastUpdated: world.lastUpdated,
    visits: world.visits,
    dateAdded: world.dateAdded,
    platform: world.platform,
    folderRefs,
    tags: world.tags,
    capacity: world.capacity,
    ...(keptForInstance ? { keptForInstance: true } : {}),
  })
}

export const WorldServiceLive = Layer.succeed(WorldService, {
  getAllWorlds: () =>
    Effect.tryPromise({
      try: async () => {
        const hidden = await hiddenWorldIds()
        return readWorlds((world) => !hidden.has(world.worldId))
      },
      catch: (e) => new Error(`Failed to get all worlds: ${e}`),
    }),

  getWorlds: (folderName) =>
    Effect.tryPromise({
      try: async () => {
        const folder = await activeFolderByName(folderName)
        if (folder === undefined) {
          return []
        }
        const hidden = await hiddenWorldIds()
        return readWorlds(
          (world) =>
            !hidden.has(world.worldId) &&
            memberFolderIds(world).includes(folder.id),
        )
      },
      catch: (e) => new Error(`Failed to get worlds: ${e}`),
    }),

  getUnclassifiedWorlds: () =>
    Effect.tryPromise({
      try: async () => {
        const hidden = await hiddenWorldIds()
        // A world whose only folders have been deleted is unclassified again,
        // so ask which memberships still name a folder that exists.
        return readWorlds(
          (world, folderNameById) =>
            !hidden.has(world.worldId) &&
            folderNamesOf(world, folderNameById).length === 0,
        )
      },
      catch: (e) => new Error(`Failed to get unclassified worlds: ${e}`),
    }),

  getHiddenWorlds: () =>
    Effect.tryPromise({
      try: async () => {
        const hidden = await hiddenWorldIds()
        return readWorlds((world) => hidden.has(world.worldId))
      },
      catch: (e) => new Error(`Failed to get hidden worlds: ${e}`),
    }),

  deleteWorld: (worldId) =>
    Effect.tryPromise({
      try: async () => {
        const gone = await tombstoned()
        await db.transaction(
          'rw',
          [
            db.worlds,
            db.worldDetails,
            db.memos,
            db.customTags,
            db.hiddenWorlds,
          ],
          async () => {
            await db.worlds.update(worldId, { ...gone })
            // Details are a cache of what VRChat says, not the user's data, so
            // there is nothing here another device needs to be told about.
            await db.worldDetails.delete(worldId)
            if ((await db.memos.get(worldId)) !== undefined) {
              await db.memos.update(worldId, { ...gone })
            }
            if ((await db.customTags.get(worldId)) !== undefined) {
              await db.customTags.update(worldId, { ...gone })
            }
            if ((await db.hiddenWorlds.get(worldId)) !== undefined) {
              await db.hiddenWorlds.update(worldId, { ...gone })
            }
          },
        )
      },
      catch: (e) => new Error(`Failed to delete world: ${e}`),
    }),

  hideWorld: (worldId) =>
    Effect.tryPromise({
      try: async () => {
        await db.hiddenWorlds.put({ worldId, ...(await touched()) })
      },
      catch: (e) => new Error(`Failed to hide world: ${e}`),
    }),

  unhideWorld: (worldId) =>
    Effect.tryPromise({
      try: async () => {
        const existing = await db.hiddenWorlds.get(worldId)
        if (existing === undefined) {
          return
        }
        await db.hiddenWorlds.update(worldId, { ...(await tombstoned()) })
      },
      catch: (e) => new Error(`Failed to unhide world: ${e}`),
    }),

  addWorldToFolder: (folderName, worldId) =>
    Effect.tryPromise({
      try: async () => {
        const folder = await activeFolderByName(folderName)
        if (folder === undefined) {
          throw new Error(`Folder "${folderName}" not found`)
        }
        const world = await db.worlds.get(worldId)
        if (world === undefined) {
          return
        }
        const now = Date.now()
        await db.worlds.update(worldId, {
          ...(await touched()),
          folderRefs: withMember(
            world.folderRefs,
            (ref) => ref.folderId === folder.id,
            (addedAt) => folderRefFor(folder.id, addedAt),
            now,
          ),
        })
      },
      catch: (e) => new Error(`Failed to add world to folder: ${e}`),
    }),

  removeWorldFromFolder: (folderName, worldId) =>
    Effect.tryPromise({
      try: async () => {
        const folder = await activeFolderByName(folderName)
        if (folder === undefined) {
          return
        }
        const world = await db.worlds.get(worldId)
        if (world === undefined) {
          return
        }
        await db.worlds.update(worldId, {
          ...(await touched()),
          folderRefs: withoutMember(
            world.folderRefs,
            (ref) => ref.folderId === folder.id,
            Date.now(),
          ),
        })
      },
      catch: (e) => new Error(`Failed to remove world from folder: ${e}`),
    }),

  getWorld: (worldId, _dontSaveToLocal) =>
    Effect.tryPromise({
      try: async () => {
        const detail = await db.worldDetails.get(worldId)
        if (detail) {
          // A row stored before the release status was kept has none, and an
          // absent status is not the same as a public world.
          return {
            ...detail,
            releaseStatus: detail.releaseStatus ?? 'unknown',
          } as WorldDetails
        }
        throw new Error(`World ${worldId} not found locally`)
      },
      catch: (e) => new Error(`Failed to get world: ${e}`),
    }),

  putWorld: (world) =>
    Effect.tryPromise({
      try: () => writeWorld(world),
      catch: (e) => new Error(`Failed to put world: ${e}`),
    }),

  rememberWorld: (world) =>
    Effect.tryPromise({
      try: async () => {
        // `dateAdded` is when this collection first had the world, and adding
        // it again -- to a second folder, or from a link -- is not that moment.
        const existing = await db.worlds.get(world.worldId)
        await writeWorld(
          existing === undefined
            ? world
            : { ...world, dateAdded: existing.dateAdded },
        )
      },
      catch: (e) => new Error(`Failed to remember world: ${e}`),
    }),

  putWorldDetails: (world) =>
    Effect.tryPromise({
      try: async () => {
        await db.worldDetails.put({
          worldId: world.worldId,
          name: world.name,
          thumbnailUrl: world.thumbnailUrl,
          authorName: world.authorName,
          authorId: world.authorId,
          favorites: world.favorites,
          lastUpdated: world.lastUpdated,
          visits: world.visits,
          platform: world.platform,
          description: world.description,
          tags: world.tags,
          capacity: world.capacity,
          recommendedCapacity: world.recommendedCapacity,
          publicationDate: world.publicationDate,
          releaseStatus: world.releaseStatus,
        })
      },
      catch: (e) => new Error(`Failed to put world details: ${e}`),
    }),

  sortWorldsDisplay: (worlds, sortField, sortDirection) =>
    Effect.succeed(
      [...worlds].sort((a, b) => {
        const dir = sortDirection === 'asc' ? 1 : -1
        switch (sortField) {
          case 'name':
            return dir * a.name.localeCompare(b.name)
          case 'visits':
            return dir * (a.visits - b.visits)
          case 'favorites':
            return dir * (a.favorites - b.favorites)
          case 'capacity':
            return dir * (a.capacity - b.capacity)
          case 'lastUpdated':
            return (
              dir *
              (new Date(a.lastUpdated).getTime() -
                new Date(b.lastUpdated).getTime())
            )
          case 'dateAdded':
          default:
            return (
              dir *
              (new Date(a.dateAdded).getTime() -
                new Date(b.dateAdded).getTime())
            )
        }
      }),
    ),
})

export { isMember }
