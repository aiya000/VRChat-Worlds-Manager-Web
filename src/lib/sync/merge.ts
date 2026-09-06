import {
  isSeed,
  SEED_TIMESTAMP,
  SNAPSHOT_FORMAT_VERSION,
  type CustomTagSyncRecord,
  type FolderOrderSyncRecord,
  type FolderRef,
  type FolderSyncRecord,
  type HiddenWorldSyncRecord,
  type LaunchedInstanceSyncRecord,
  type MemoConflict,
  type MemoSyncRecord,
  type MergeResult,
  type SetRef,
  type SettingsOverride,
  type Snapshot,
  type SyncedSetting,
  type SyncMeta,
  type TagRef,
  type WorldSyncRecord,
} from './types'

/**
 * How recent a row is, for the purpose of deciding a merge. A delete is a
 * change like any other, so a tombstone counts even if the writer forgot to
 * bump `updatedAt` alongside it.
 */
function stampOf(meta: SyncMeta): number {
  return Math.max(meta.updatedAt, meta.deletedAt ?? 0)
}

/**
 * Whether `a` beats `b`. Ties fall to whichever device id sorts higher, which
 * keeps the result the same no matter which side ran the merge.
 */
function wins(a: SyncMeta, b: SyncMeta): boolean {
  const stampA = stampOf(a)
  const stampB = stampOf(b)
  if (stampA !== stampB) {
    return stampA > stampB
  }
  return a.origin > b.origin
}

function bothSeed(a: SyncMeta, b: SyncMeta): boolean {
  return isSeed(stampOf(a)) && isSeed(stampOf(b))
}

/**
 * A pair of tombstones with no usable timestamps only counts as a deletion if
 * both sides agree. Nothing may disappear because one side simply never heard
 * of it.
 */
function mergeSeedTombstone(a: number | null, b: number | null): number | null {
  if (a === null || b === null) {
    return null
  }
  return Math.min(a, b)
}

function refStamp(ref: SetRef): number {
  return Math.max(ref.addedAt, ref.removedAt ?? 0)
}

/**
 * Observed-remove set merge: each element carries its own timestamps, so two
 * devices touching different elements never overwrite each other. On an exact
 * tie the element stays a member -- losing a membership is the expensive
 * mistake, gaining one back is not.
 */
export function mergeSet<T extends SetRef>(
  a: T[],
  b: T[],
  keyOf: (ref: T) => string,
): T[] {
  const byKey = new Map<string, T>()

  for (const ref of [...a, ...b]) {
    const key = keyOf(ref)
    const current = byKey.get(key)
    if (current === undefined) {
      byKey.set(key, ref)
      continue
    }

    const stamp = refStamp(ref)
    const currentStamp = refStamp(current)
    if (stamp > currentStamp) {
      byKey.set(key, ref)
      continue
    }
    if (stamp === currentStamp && ref.removedAt === null) {
      byKey.set(key, ref)
    }
  }

  return [...byKey.entries()]
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, ref]) => ref)
}

export function isMember(ref: SetRef): boolean {
  return ref.removedAt === null || ref.addedAt > ref.removedAt
}

function earlierDate(a: string, b: string): string {
  const timeA = Date.parse(a)
  const timeB = Date.parse(b)
  if (Number.isNaN(timeA)) {
    return b
  }
  if (Number.isNaN(timeB)) {
    return a
  }
  return timeA <= timeB ? a : b
}

function indexBy<T>(
  records: T[],
  keyOf: (record: T) => string,
): Map<string, T> {
  const byKey = new Map<string, T>()
  for (const record of records) {
    byKey.set(keyOf(record), record)
  }
  return byKey
}

function allKeys(...maps: Map<string, unknown>[]): string[] {
  const keys = new Set<string>()
  for (const map of maps) {
    for (const key of map.keys()) {
      keys.add(key)
    }
  }
  return [...keys].sort()
}

function mergedMeta(a: SyncMeta, b: SyncMeta): SyncMeta {
  if (bothSeed(a, b)) {
    return {
      updatedAt: SEED_TIMESTAMP,
      deletedAt: mergeSeedTombstone(a.deletedAt, b.deletedAt),
      origin: a.origin > b.origin ? a.origin : b.origin,
    }
  }

  const winner = wins(a, b) ? a : b
  return {
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    deletedAt: winner.deletedAt,
    origin: winner.origin,
  }
}

export function mergeWorld(
  a: WorldSyncRecord,
  b: WorldSyncRecord,
): WorldSyncRecord {
  const winner = wins(a, b) ? a : b

  return {
    ...mergedMeta(a, b),
    worldId: a.worldId,
    // The day a world was first saved is a fact, not an edit: the earlier
    // claim is the true one however late the other device heard about it.
    dateAdded: earlierDate(a.dateAdded, b.dateAdded),
    folderRefs: mergeSet(a.folderRefs, b.folderRefs, (ref) => ref.folderId),
    seed: winner.seed ?? a.seed ?? b.seed,
  }
}

export function mergeFolder(
  a: FolderSyncRecord,
  b: FolderSyncRecord,
): FolderSyncRecord {
  if (bothSeed(a, b)) {
    return { ...mergedMeta(a, b), id: a.id, name: a.name }
  }

  const winner = wins(a, b) ? a : b
  return { ...mergedMeta(a, b), id: a.id, name: winner.name }
}

export function mergeHiddenWorld(
  a: HiddenWorldSyncRecord,
  b: HiddenWorldSyncRecord,
): HiddenWorldSyncRecord {
  return { ...mergedMeta(a, b), worldId: a.worldId }
}

/**
 * An instance never changes after it is made -- the world, the id, the region
 * and the moment are all fixed -- so there is nothing here to disagree about.
 * Only the tombstone matters, which is what `mergedMeta` settles: pruning it on
 * one device prunes it everywhere rather than the row coming back on the next
 * merge.
 */
export function mergeLaunchedInstance(
  a: LaunchedInstanceSyncRecord,
  b: LaunchedInstanceSyncRecord,
): LaunchedInstanceSyncRecord {
  const winner = wins(a, b) ? a : b
  return {
    ...mergedMeta(a, b),
    id: a.id,
    worldId: a.worldId,
    instanceId: a.instanceId,
    shortName: winner.shortName,
    instanceType: winner.instanceType,
    region: winner.region,
    // The earlier of the two: it records when the instance was made, which is
    // a fact about the instance rather than something either device edited.
    launchedAt: Math.min(a.launchedAt, b.launchedAt),
  }
}

export function mergeCustomTag(
  a: CustomTagSyncRecord,
  b: CustomTagSyncRecord,
): CustomTagSyncRecord {
  return {
    ...mergedMeta(a, b),
    worldId: a.worldId,
    tagRefs: mergeSet(a.tagRefs, b.tagRefs, (ref) => ref.name),
  }
}

/**
 * Memos are the one place a merge can destroy something a person typed, so the
 * loser's text is kept in `conflictBackup` rather than dropped.
 *
 * When neither side has a usable timestamp and both hold different text, the
 * local text stays on screen. That is the only rule here that depends on which
 * argument is which, and it is deliberate: the text the user is looking at
 * should not change under them.
 */
export function mergeMemo(
  local: MemoSyncRecord,
  remote: MemoSyncRecord,
): { record: MemoSyncRecord; conflict: MemoConflict | null } {
  const meta = mergedMeta(local, remote)

  const decide = (): { kept: MemoSyncRecord; lost: MemoSyncRecord } => {
    if (!bothSeed(local, remote)) {
      return wins(local, remote)
        ? { kept: local, lost: remote }
        : { kept: remote, lost: local }
    }
    if (local.memo === '') {
      return { kept: remote, lost: local }
    }
    return { kept: local, lost: remote }
  }

  const { kept, lost } = decide()

  const textWasLost = lost.memo !== '' && lost.memo !== kept.memo
  const conflict: MemoConflict | null = textWasLost
    ? {
        worldId: local.worldId,
        keptText: kept.memo,
        backedUpText: lost.memo,
      }
    : null

  return {
    record: {
      ...meta,
      worldId: local.worldId,
      memo: kept.memo,
      conflictBackup: textWasLost
        ? { text: lost.memo, at: lost.updatedAt }
        : (kept.conflictBackup ?? lost.conflictBackup),
    },
    conflict,
  }
}

/**
 * Folder order is the one thing merged by last-write-wins rather than
 * element-wise, and the cost is real: two devices reordering at once means the
 * earlier reordering is lost entirely.
 *
 * It buys a much simpler schema, and the trade is worth it because no folder
 * ever disappears -- ids the loser knew about are appended rather than
 * dropped, and a lost ordering takes seconds to redo while a lost folder
 * assignment cannot be reconstructed at all.
 */
export function mergeFolderOrder(
  a: FolderOrderSyncRecord,
  b: FolderOrderSyncRecord,
  liveIds: string[],
): FolderOrderSyncRecord {
  const winner =
    a.updatedAt !== b.updatedAt
      ? a.updatedAt > b.updatedAt
        ? a
        : b
      : a.origin >= b.origin
        ? a
        : b
  const loser = winner === a ? b : a

  const live = new Set(liveIds)
  const ids: string[] = []
  const seen = new Set<string>()

  for (const source of [winner.ids, loser.ids, liveIds]) {
    for (const id of source) {
      if (live.has(id) && !seen.has(id)) {
        seen.add(id)
        ids.push(id)
      }
    }
  }

  return {
    ids,
    updatedAt: Math.max(a.updatedAt, b.updatedAt),
    origin: winner.origin,
  }
}

function mergeSettings(
  a: Record<string, SyncedSetting>,
  b: Record<string, SyncedSetting>,
  originA: string,
  originB: string,
): Record<string, SyncedSetting> {
  const merged: Record<string, SyncedSetting> = {}

  for (const key of [
    ...new Set([...Object.keys(a), ...Object.keys(b)]),
  ].sort()) {
    const left = a[key]
    const right = b[key]
    if (left === undefined) {
      merged[key] = right
      continue
    }
    if (right === undefined) {
      merged[key] = left
      continue
    }
    if (left.updatedAt !== right.updatedAt) {
      merged[key] = left.updatedAt > right.updatedAt ? left : right
      continue
    }
    merged[key] = originA >= originB ? left : right
  }

  return merged
}

/**
 * Two devices that migrated independently each invented their own id for the
 * same folder. While neither side has real timestamps, a shared name is the
 * only evidence they are the same folder, so fold the remote id into the local
 * one before merging anything that points at it.
 */
function buildFolderIdRemapping(
  local: FolderSyncRecord[],
  remote: FolderSyncRecord[],
): Record<string, string> {
  const localSeedIdByName = new Map<string, string>()
  for (const folder of local) {
    if (isSeed(stampOf(folder)) && folder.deletedAt === null) {
      localSeedIdByName.set(folder.name, folder.id)
    }
  }

  const remapping: Record<string, string> = {}
  for (const folder of remote) {
    if (!isSeed(stampOf(folder)) || folder.deletedAt !== null) {
      continue
    }
    const localId = localSeedIdByName.get(folder.name)
    if (localId !== undefined && localId !== folder.id) {
      remapping[folder.id] = localId
    }
  }
  return remapping
}

function applyFolderIdRemapping(
  snapshot: Snapshot,
  remapping: Record<string, string>,
): Snapshot {
  if (Object.keys(remapping).length === 0) {
    return snapshot
  }

  const remap = (id: string): string => remapping[id] ?? id

  return {
    ...snapshot,
    folders: snapshot.folders.map((folder) => ({
      ...folder,
      id: remap(folder.id),
    })),
    worlds: snapshot.worlds.map((world) => ({
      ...world,
      folderRefs: mergeSet<FolderRef>(
        world.folderRefs.map((ref) => ({
          ...ref,
          folderId: remap(ref.folderId),
        })),
        [],
        (ref) => ref.folderId,
      ),
    })),
    folderOrder: {
      ...snapshot.folderOrder,
      ids: [...new Set(snapshot.folderOrder.ids.map(remap))],
    },
  }
}

export function emptySnapshot(deviceId: string): Snapshot {
  return {
    formatVersion: SNAPSHOT_FORMAT_VERSION,
    metadata: {
      date: new Date(0).toISOString(),
      number_of_folders: 0,
      number_of_worlds: 0,
      app_version: 'unknown',
    },
    deviceId,
    worlds: [],
    folders: [],
    folderOrder: { ids: [], updatedAt: SEED_TIMESTAMP, origin: '' },
    hiddenWorlds: [],
    memos: [],
    customTags: [],
    launchedInstances: [],
    settings: {},
    settingsOverride: null,
  }
}

/**
 * The newer of two demands, or whichever exists.
 *
 * It rides along in the file rather than being consumed by the merge, because
 * the device that has to obey it may not be the one that merged it in. Whether
 * it is still owed is decided where it lands -- see `SettingsOverride`.
 */
function mergeSettingsOverride(
  a: SettingsOverride | null,
  b: SettingsOverride | null,
): SettingsOverride | null {
  if (a === null) {
    return b
  }
  if (b === null) {
    return a
  }
  if (a.at !== b.at) {
    return a.at > b.at ? a : b
  }
  return a.origin >= b.origin ? a : b
}

function mergeRecords<T>(
  a: T[],
  b: T[],
  keyOf: (record: T) => string,
  merge: (left: T, right: T) => T,
): T[] {
  const byKeyA = indexBy(a, keyOf)
  const byKeyB = indexBy(b, keyOf)

  return allKeys(byKeyA, byKeyB).map((key) => {
    const left = byKeyA.get(key)
    const right = byKeyB.get(key)
    if (left === undefined) {
      return right as T
    }
    if (right === undefined) {
      return left
    }
    return merge(left, right)
  })
}

/**
 * The whole of the sync logic, and the whole of #78's incremental restore: a
 * local snapshot and an incoming one become a third snapshot that keeps
 * everything either side knew.
 *
 * `local` is not merely the first argument -- when neither side has usable
 * timestamps and a memo differs, its text is the one that stays.
 */
export function mergeSnapshot(
  local: Snapshot,
  incoming: Snapshot,
): MergeResult {
  const folderIdRemapping = buildFolderIdRemapping(
    local.folders,
    incoming.folders,
  )
  const remote = applyFolderIdRemapping(incoming, folderIdRemapping)

  const folders = mergeRecords(
    local.folders,
    remote.folders,
    (folder) => folder.id,
    mergeFolder,
  )

  const worlds = mergeRecords(
    local.worlds,
    remote.worlds,
    (world) => world.worldId,
    mergeWorld,
  )

  const hiddenWorlds = mergeRecords(
    local.hiddenWorlds,
    remote.hiddenWorlds,
    (hidden) => hidden.worldId,
    mergeHiddenWorld,
  )

  const customTags = mergeRecords(
    local.customTags,
    remote.customTags,
    (tag) => tag.worldId,
    mergeCustomTag,
  )

  const memoConflicts: MemoConflict[] = []
  const memos = mergeRecords(
    local.memos,
    remote.memos,
    (memo) => memo.worldId,
    (left, right) => {
      const { record, conflict } = mergeMemo(left, right)
      if (conflict !== null) {
        memoConflicts.push(conflict)
      }
      return record
    },
  )

  const launchedInstances = mergeRecords(
    local.launchedInstances,
    remote.launchedInstances,
    (instance) => instance.id,
    mergeLaunchedInstance,
  )

  const liveFolderIds = folders
    .filter((folder) => folder.deletedAt === null)
    .map((folder) => folder.id)

  const folderOrder = mergeFolderOrder(
    local.folderOrder,
    remote.folderOrder,
    liveFolderIds,
  )

  const liveWorldCount = worlds.filter(
    (world) => world.deletedAt === null,
  ).length

  return {
    snapshot: {
      formatVersion: SNAPSHOT_FORMAT_VERSION,
      metadata: {
        date: new Date().toISOString(),
        number_of_folders: liveFolderIds.length,
        number_of_worlds: liveWorldCount,
        app_version: local.metadata.app_version,
      },
      deviceId: local.deviceId,
      worlds,
      folders,
      folderOrder,
      hiddenWorlds,
      memos,
      customTags,
      launchedInstances,
      settings: mergeSettings(
        local.settings,
        remote.settings,
        local.deviceId,
        remote.deviceId,
      ),
      settingsOverride: mergeSettingsOverride(
        local.settingsOverride,
        remote.settingsOverride,
      ),
    },
    memoConflicts,
    folderIdRemapping,
  }
}

export type { TagRef }
