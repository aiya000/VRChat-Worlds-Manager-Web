import type { BackupMetaData, Platform } from '@/lib/types'
import { SEED_TIMESTAMP, SNAPSHOT_FORMAT_VERSION, type Snapshot } from './types'

/**
 * The shape written by every backup this app has produced so far. It has no
 * `formatVersion`, no timestamps and no record of anything deleted.
 */
export interface LegacyBackup {
  metadata: BackupMetaData
  worlds: {
    worldId: string
    name: string
    thumbnailUrl: string
    authorName: string
    favorites: number
    lastUpdated: string
    visits: number
    dateAdded: string
    platform: Platform[]
    folders: string[]
    tags: string[]
    capacity: number
  }[]
  folders: { name: string; world_count: number }[]
  hiddenWorlds: string[]
  memos: Record<string, string>
  customTags: Record<string, string[]>
}

export function isLegacyBackup(parsed: unknown): parsed is LegacyBackup {
  if (typeof parsed !== 'object' || parsed === null) {
    return false
  }
  const candidate = parsed as { formatVersion?: unknown; worlds?: unknown }
  return (
    candidate.formatVersion === undefined && Array.isArray(candidate.worlds)
  )
}

/**
 * Reads an old backup as a snapshot whose every timestamp is unknown.
 *
 * That is what makes restoring one incremental (#78) rather than destructive:
 * a snapshot of unknowns merges with the local one by union, so a backup taken
 * before today's folder was created cannot take that folder away again.
 */
export function fromLegacyBackup(
  backup: LegacyBackup,
  options: { deviceId: string; newId: () => string },
): Snapshot {
  const { deviceId, newId } = options

  const folderIdByName = new Map<string, string>()
  for (const folder of backup.folders) {
    if (!folderIdByName.has(folder.name)) {
      folderIdByName.set(folder.name, newId())
    }
  }
  // A world may name a folder the folder list forgot to mention.
  for (const world of backup.worlds) {
    for (const name of world.folders) {
      if (!folderIdByName.has(name)) {
        folderIdByName.set(name, newId())
      }
    }
  }

  const seedMeta = {
    updatedAt: SEED_TIMESTAMP,
    deletedAt: null,
    origin: '',
  } as const

  return {
    formatVersion: SNAPSHOT_FORMAT_VERSION,
    metadata: backup.metadata,
    deviceId,
    worlds: backup.worlds.map((world) => ({
      ...seedMeta,
      worldId: world.worldId,
      dateAdded: world.dateAdded,
      folderRefs: world.folders.map((name) => ({
        folderId: folderIdByName.get(name) as string,
        addedAt: SEED_TIMESTAMP,
        removedAt: null,
      })),
      seed: {
        name: world.name,
        thumbnailUrl: world.thumbnailUrl,
        authorName: world.authorName,
        favorites: world.favorites,
        lastUpdated: world.lastUpdated,
        visits: world.visits,
        platform: world.platform,
        tags: world.tags,
        capacity: world.capacity,
      },
    })),
    folders: [...folderIdByName.entries()].map(([name, id]) => ({
      ...seedMeta,
      id,
      name,
    })),
    folderOrder: {
      // Only the folders the backup listed have a known order; ones recovered
      // from a world's own list are appended by the merge.
      ids: backup.folders.map(
        (folder) => folderIdByName.get(folder.name) as string,
      ),
      updatedAt: SEED_TIMESTAMP,
      origin: '',
    },
    hiddenWorlds: backup.hiddenWorlds.map((worldId) => ({
      ...seedMeta,
      worldId,
    })),
    memos: Object.entries(backup.memos).map(([worldId, memo]) => ({
      ...seedMeta,
      worldId,
      memo,
      conflictBackup: null,
    })),
    customTags: Object.entries(backup.customTags).map(([worldId, tags]) => ({
      ...seedMeta,
      worldId,
      tagRefs: tags.map((name) => ({
        name,
        addedAt: SEED_TIMESTAMP,
        removedAt: null,
      })),
    })),
    launchedInstances: [],
    settings: {},
  }
}
