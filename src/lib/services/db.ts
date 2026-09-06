import Dexie, { type EntityTable, type Transaction } from 'dexie'
import type { Platform } from '@/lib/types'
import { SEED_TIMESTAMP } from '@/lib/sync/types'
import { notifyLocalChange } from './local-changes'

/**
 * Sync bookkeeping carried by every row a user can change.
 *
 * `deletedAt` is a tombstone: the row stays so that other devices, and older
 * backups, learn the deletion happened instead of quietly adding the row back.
 * Readers must therefore filter on it -- see `isActive`.
 */
export interface SyncMeta {
  updatedAt: number
  deletedAt: number | null
  /** Device that last wrote the row. Breaks ties between equal timestamps. */
  origin: string
}

/**
 * An element of a set whose membership is decided per element rather than by
 * replacing the whole collection, so two devices editing different elements do
 * not overwrite each other.
 */
export interface SetRef {
  addedAt: number
  removedAt: number | null
}

export interface FolderRef extends SetRef {
  folderId: string
}

export interface TagRef extends SetRef {
  name: string
}

export interface WorldRecord extends SyncMeta {
  worldId: string
  name: string
  thumbnailUrl: string
  authorName: string
  favorites: number
  lastUpdated: string
  visits: number
  dateAdded: string
  platform: Platform[]
  /** Folder membership by id, so renaming a folder does not lose it. */
  folderRefs: FolderRef[]
  /** VRChat's own tags, not the user's. Refreshed from the API, never merged. */
  tags: string[]
  capacity: number
}

export interface WorldDetailRecord {
  worldId: string
  name: string
  thumbnailUrl: string
  authorName: string
  authorId: string
  favorites: number
  lastUpdated: string
  visits: number
  platform: Platform[]
  description: string
  tags: string[]
  capacity: number
  recommendedCapacity: number | null
  publicationDate: string | null
}

export interface FolderRecord extends SyncMeta {
  /** Stable across renames, which the previous `name` primary key was not. */
  id: string
  name: string
}

/**
 * The order of the folder list, as one row rather than a column on each folder.
 *
 * Reordering is the one thing merged by last-write-wins, so it is one value to
 * compare rather than a number on every row that a merge could interleave into
 * an order nobody chose.
 */
export interface FolderOrderRecord {
  key: string
  ids: string[]
  updatedAt: number
  origin: string
}

export const FOLDER_ORDER_KEY = 'default'

export interface HiddenWorldRecord extends SyncMeta {
  worldId: string
}

export interface MemoRecord extends SyncMeta {
  worldId: string
  memo: string
  /** Text that lost a merge, kept so nothing a user typed is destroyed. */
  conflictBackup: { text: string; at: number } | null
}

export interface CustomTagRecord extends SyncMeta {
  worldId: string
  tagRefs: TagRef[]
}

/**
 * An instance the user made for a world, kept so it can be entered again.
 *
 * A launch URL is built from `worldId:instanceId` and nothing else, so this row
 * is enough on its own.
 */
export interface LaunchedInstanceRecord extends SyncMeta {
  id: string
  worldId: string
  instanceId: string
  shortName: string | null
  instanceType: string
  region: string
  launchedAt: number
}

export interface AuthStateRecord {
  key: string
  value: string
}

export interface SyncStateRecord {
  key: string
  value: string
}

export function isActive(record: SyncMeta): boolean {
  return record.deletedAt === null
}

export function isMember(ref: SetRef): boolean {
  return ref.removedAt === null || ref.addedAt > ref.removedAt
}

/**
 * The schema version this bundle knows how to open. A browser holding a newer
 * database -- because another tab, or a cached older bundle, has already been
 * upgraded -- cannot be served by this code at all: IndexedDB refuses to open a
 * store at a version below the one on disk. `StaleBundleNotice` checks for that
 * and asks for a reload rather than letting every query fail.
 */
export const APP_DB_VERSION = 5

export const APP_DB_NAME = 'VRChatWorldsManager'

/**
 * The version IndexedDB itself records, which is not `APP_DB_VERSION`: Dexie
 * multiplies its own schema version by ten, so `version(1)` is version 10 on
 * disk. `indexedDB.databases()` reports that number, so anything comparing
 * against it has to use this one.
 */
export const APP_IDB_VERSION = APP_DB_VERSION * 10

interface LegacyWorldRow {
  worldId: string
  folders?: string[]
}

interface LegacyFolderRow {
  name: string
  order: number
}

interface LegacyCustomTagRow {
  worldId: string
  tags?: string[]
}

/**
 * Gives rows that predate sync the timestamps the merge engine needs.
 *
 * Every one of them gets `SEED_TIMESTAMP`, never `Date.now()`. Stamping them
 * with the migration time would have two devices each claim "I changed
 * everything, just now", and the device that migrated later would win every
 * field on the first sync -- taking the other one's folder assignments with it.
 * `0` means "time unknown", and the merge unions a pair of unknowns rather than
 * picking a winner.
 */
async function upgradeToVersion2(tx: Transaction): Promise<void> {
  const seed = {
    updatedAt: SEED_TIMESTAMP,
    deletedAt: null,
    origin: '',
  } as const

  const folderIdByName = new Map<string, string>()
  const legacyFolders = (await tx
    .table('folders')
    .toArray()) as LegacyFolderRow[]
  const ordered = [...legacyFolders].sort((a, b) => a.order - b.order)

  // Copied into a new store rather than reshaped in place: Dexie cannot change
  // a table's primary key, and `folders` was keyed by the folder's name, which
  // is the very thing that has to stop being its identity.
  for (const folder of ordered) {
    const id = crypto.randomUUID()
    folderIdByName.set(folder.name, id)
    await tx.table('foldersById').add({ ...seed, id, name: folder.name })
  }

  await tx.table('folderOrder').put({
    key: FOLDER_ORDER_KEY,
    ids: ordered.map((folder) => folderIdByName.get(folder.name) as string),
    updatedAt: SEED_TIMESTAMP,
    origin: '',
  })

  await tx
    .table('worlds')
    .toCollection()
    .modify((row: LegacyWorldRow & Partial<WorldRecord>) => {
      const names = row.folders ?? []
      row.folderRefs = names
        .filter((name) => folderIdByName.has(name))
        .map((name) => ({
          folderId: folderIdByName.get(name) as string,
          addedAt: SEED_TIMESTAMP,
          removedAt: null,
        }))
      delete (row as LegacyWorldRow).folders
      Object.assign(row, seed)
    })

  await tx
    .table('customTags')
    .toCollection()
    .modify((row: LegacyCustomTagRow & Partial<CustomTagRecord>) => {
      row.tagRefs = (row.tags ?? []).map((name) => ({
        name,
        addedAt: SEED_TIMESTAMP,
        removedAt: null,
      }))
      delete (row as LegacyCustomTagRow).tags
      Object.assign(row, seed)
    })

  for (const table of ['hiddenWorlds', 'memos']) {
    await tx
      .table(table)
      .toCollection()
      .modify((row: Partial<MemoRecord>) => {
        Object.assign(row, seed)
        if (table === 'memos') {
          row.conflictBackup = null
        }
      })
  }
}

export class AppDatabase extends Dexie {
  worlds!: EntityTable<WorldRecord, 'worldId'>
  worldDetails!: EntityTable<WorldDetailRecord, 'worldId'>
  foldersById!: EntityTable<FolderRecord, 'id'>
  folderOrder!: EntityTable<FolderOrderRecord, 'key'>
  hiddenWorlds!: EntityTable<HiddenWorldRecord, 'worldId'>
  memos!: EntityTable<MemoRecord, 'worldId'>
  customTags!: EntityTable<CustomTagRecord, 'worldId'>
  launchedInstances!: EntityTable<LaunchedInstanceRecord, 'id'>
  authState!: EntityTable<AuthStateRecord, 'key'>
  syncState!: EntityTable<SyncStateRecord, 'key'>
  // A separate table from `authState` on purpose: VRChat's own logout clears
  // `authState` wholesale (`clearAuth`), and signing out of VRChat has nothing
  // to do with a Google Drive connection made on the same device.
  googleAuthState!: EntityTable<AuthStateRecord, 'key'>

  constructor() {
    super(APP_DB_NAME)
    this.version(1).stores({
      worlds:
        'worldId, name, authorName, favorites, lastUpdated, visits, dateAdded, capacity',
      worldDetails: 'worldId',
      folders: 'name, order',
      hiddenWorlds: 'worldId',
      memos: 'worldId',
      customTags: 'worldId',
      authState: 'key',
    })
    this.version(2)
      .stores({
        worlds:
          'worldId, name, authorName, favorites, lastUpdated, visits, dateAdded, capacity, updatedAt, deletedAt',
        foldersById: 'id, &name, updatedAt, deletedAt',
        folderOrder: 'key',
        hiddenWorlds: 'worldId, updatedAt, deletedAt',
        memos: 'worldId, updatedAt, deletedAt',
        customTags: 'worldId, updatedAt, deletedAt',
        syncState: 'key',
      })
      .upgrade(upgradeToVersion2)
    // Dropped in its own version: the upgrade above still has to read it, and
    // a store deleted by version 2's schema would already be gone by then.
    this.version(3).stores({ folders: null })
    // Purely additive, so there is nothing to upgrade: a database that has
    // never held an instance simply gains an empty store.
    this.version(4).stores({
      launchedInstances: 'id, worldId, launchedAt, updatedAt, deletedAt',
    })
    // Purely additive, same as version 4.
    this.version(APP_DB_VERSION).stores({ googleAuthState: 'key' })
  }
}

export const db = new AppDatabase()

/**
 * The tables a snapshot is made of. Everything else -- `worldDetails`, which
 * is a cache of VRChat's own answers, and the two `*State` tables -- is
 * deliberately absent: nothing in them is ever sent to Drive, so a write to
 * one is not a reason to sync.
 */
const SYNCED_TABLES = [
  db.worlds,
  db.foldersById,
  db.folderOrder,
  db.hiddenWorlds,
  db.memos,
  db.customTags,
  db.launchedInstances,
]

// Installed here, next to the schema, rather than by whoever wants the signal:
// a hook added later would miss every write made before it, and there is no
// moment in this app's life when the answer to "did anything change?" is
// allowed to be wrong.
for (const table of SYNCED_TABLES) {
  // Returning nothing from any of these leaves Dexie's own behaviour alone;
  // `updating` in particular treats a returned object as a modification.
  table.hook('creating', () => {
    notifyLocalChange()
  })
  table.hook('updating', () => {
    notifyLocalChange()
    return undefined
  })
  table.hook('deleting', () => {
    notifyLocalChange()
  })
}
