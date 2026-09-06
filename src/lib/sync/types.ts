import type { BackupMetaData, Platform } from '@/lib/types'

/**
 * The timestamp given to rows that predate sync.
 *
 * Rows written before the schema carried timestamps have no honest value to
 * put here, and stamping them with the migration's `Date.now()` would be
 * actively harmful: two devices would each claim "I changed everything, just
 * now", and the one that migrated later would win every field on the first
 * sync -- silently taking the other device's folder assignments with it.
 *
 * `0` means "time unknown" instead, and a pair of unknowns is merged by taking
 * the union rather than by picking a winner. See `isSeed`.
 */
export const SEED_TIMESTAMP = 0

export function isSeed(updatedAt: number): boolean {
  return updatedAt === SEED_TIMESTAMP
}

/**
 * An element of an observed-remove set. Membership is decided by which of the
 * two stamps is later, so two devices adding the same world to different
 * folders keep both memberships instead of one overwriting the other.
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

export interface SyncMeta {
  updatedAt: number
  /** Tombstone. The row stays; readers filter on this being `null`. */
  deletedAt: number | null
  /** The `deviceId` of whoever last wrote the row. Breaks timestamp ties. */
  origin: string
}

/**
 * What VRChat says about a world. Carried so a device seeing a world for the
 * first time can render it without asking the API for hundreds of worlds at
 * once, and never used to overwrite a row that already exists locally.
 */
export interface WorldSeed {
  name: string
  thumbnailUrl: string
  authorName: string
  favorites: number
  lastUpdated: string
  visits: number
  platform: Platform[]
  tags: string[]
  capacity: number
}

export interface WorldSyncRecord extends SyncMeta {
  worldId: string
  /** Merged by taking the earlier of the two: it records a fact, not an edit. */
  dateAdded: string
  folderRefs: FolderRef[]
  seed: WorldSeed | null
}

export interface FolderSyncRecord extends SyncMeta {
  id: string
  name: string
}

export interface FolderOrderSyncRecord {
  ids: string[]
  updatedAt: number
  origin: string
}

export interface HiddenWorldSyncRecord extends SyncMeta {
  worldId: string
}

export interface MemoSyncRecord extends SyncMeta {
  worldId: string
  memo: string
  /** Text that lost a merge, kept so nothing a user typed is destroyed. */
  conflictBackup: { text: string; at: number } | null
}

export interface CustomTagSyncRecord extends SyncMeta {
  worldId: string
  tagRefs: TagRef[]
}

/**
 * An instance the user made for a world, kept so it can be entered again.
 *
 * A launch URL is `worldId:instanceId` and nothing else, so a saved row is
 * enough on its own: it needs nothing from VRChat's API.
 */
export interface LaunchedInstanceSyncRecord extends SyncMeta {
  /** `worldId:instanceId`. Two devices cannot mint the same one. */
  id: string
  worldId: string
  instanceId: string
  shortName: string | null
  /** What was asked for when it was made: `public`, `friends`, a group type. */
  instanceType: string
  region: string
  /** When it was made. What the list is ordered by. */
  launchedAt: number
}

export interface SyncedSetting {
  value: string
  updatedAt: number
}

export const SNAPSHOT_FORMAT_VERSION = 2

export interface Snapshot {
  formatVersion: typeof SNAPSHOT_FORMAT_VERSION
  metadata: BackupMetaData
  deviceId: string
  worlds: WorldSyncRecord[]
  folders: FolderSyncRecord[]
  folderOrder: FolderOrderSyncRecord
  hiddenWorlds: HiddenWorldSyncRecord[]
  memos: MemoSyncRecord[]
  customTags: CustomTagSyncRecord[]
  /**
   * Added after `formatVersion` 2 was already being written. The version is
   * deliberately not bumped for it: a file that predates the field is still a
   * perfectly good backup, and rejecting one would take away the ability to
   * restore anything written by 2.2.0.
   */
  launchedInstances: LaunchedInstanceSyncRecord[]
  settings: Record<string, SyncedSetting>
}

/**
 * A memo whose text lost the merge. Surfaced so the user can be told, rather
 * than discovering later that a note changed under them.
 */
export interface MemoConflict {
  worldId: string
  keptText: string
  backedUpText: string
}

export interface MergeResult {
  snapshot: Snapshot
  memoConflicts: MemoConflict[]
  /**
   * Remote folder ids that were folded into a local folder of the same name.
   * Only ever produced on the first merge between two devices that migrated
   * independently, when neither side has real timestamps yet.
   */
  folderIdRemapping: Record<string, string>
}
