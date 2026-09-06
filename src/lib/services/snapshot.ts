import type { Platform } from '@/lib/types'
import {
  fromLegacyBackup,
  isLegacyBackup,
  type LegacyBackup,
} from '@/lib/sync/legacy-backup'
import { emptySnapshot } from '@/lib/sync/merge'
import {
  selectSettingsToApply,
  selectSettingsToForce,
  selectSyncedSettings,
} from '@/lib/sync/settings'
import {
  SNAPSHOT_FORMAT_VERSION,
  type SettingsOverride,
  type Snapshot,
  type WorldSyncRecord,
} from '@/lib/sync/types'
import { db, FOLDER_ORDER_KEY, type WorldRecord } from './db'
import {
  readPendingSettingsOverrideAt,
  readSettingEntries,
  readSettingSyncOverrides,
  rememberAppliedSettingsOverride,
  shouldObeySettingsOverride,
  writeSettingEntries,
} from './setting-sync'
import { deviceId } from './sync-meta'

/**
 * The whole database as a snapshot the merge engine can work on.
 *
 * VRChat's own fields travel as `seed` rather than as data to be merged: they
 * are refreshed from the API, so the only thing another device needs them for
 * is drawing a world it has never seen.
 */
export async function readSnapshot(): Promise<Snapshot> {
  const [
    worlds,
    folders,
    folderOrder,
    hiddenWorlds,
    memos,
    customTags,
    launchedInstances,
  ] = await Promise.all([
    db.worlds.toArray(),
    db.foldersById.toArray(),
    db.folderOrder.get(FOLDER_ORDER_KEY),
    db.hiddenWorlds.toArray(),
    db.memos.toArray(),
    db.customTags.toArray(),
    db.launchedInstances.toArray(),
  ])

  // A demand waiting to go out changes what this device publishes: everything
  // it holds, stamped now, rather than the keys it ordinarily shares.
  const overrideAt = readPendingSettingsOverrideAt()
  const settingsOverride: SettingsOverride | null =
    overrideAt === null ? null : { origin: await deviceId(), at: overrideAt }
  const settingEntries = readSettingEntries()

  return {
    formatVersion: SNAPSHOT_FORMAT_VERSION,
    metadata: {
      date: new Date().toISOString(),
      number_of_folders: folders.filter((f) => f.deletedAt === null).length,
      number_of_worlds: worlds.filter((w) => w.deletedAt === null).length,
      app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? 'unknown',
    },
    deviceId: await deviceId(),
    worlds: worlds.map((world) => ({
      worldId: world.worldId,
      dateAdded: world.dateAdded,
      folderRefs: world.folderRefs,
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
      updatedAt: world.updatedAt,
      deletedAt: world.deletedAt,
      origin: world.origin,
    })),
    folders,
    folderOrder: folderOrder ?? {
      ids: [],
      updatedAt: 0,
      origin: '',
    },
    hiddenWorlds,
    memos,
    customTags,
    launchedInstances,
    settings:
      settingsOverride === null
        ? selectSyncedSettings(settingEntries, readSettingSyncOverrides())
        : selectSettingsToForce(settingEntries, settingsOverride.at),
    settingsOverride,
  }
}

const UNKNOWN_WORLD = {
  name: '',
  thumbnailUrl: '',
  authorName: '',
  favorites: 0,
  lastUpdated: '',
  visits: 0,
  platform: [] as Platform[],
  tags: [] as string[],
  capacity: 0,
}

function toWorldRecord(
  world: WorldSyncRecord,
  existing: WorldRecord | undefined,
): WorldRecord {
  // What VRChat says about a world is refreshed from VRChat, so a row already
  // here keeps its own copy and only a world this device has never seen falls
  // back to what the snapshot carried.
  const vrchat = existing ?? world.seed ?? UNKNOWN_WORLD

  return {
    worldId: world.worldId,
    name: vrchat.name,
    thumbnailUrl: vrchat.thumbnailUrl,
    authorName: vrchat.authorName,
    favorites: vrchat.favorites,
    lastUpdated: vrchat.lastUpdated,
    visits: vrchat.visits,
    platform: [...vrchat.platform],
    tags: [...vrchat.tags],
    capacity: vrchat.capacity,
    dateAdded: world.dateAdded,
    folderRefs: world.folderRefs,
    updatedAt: world.updatedAt,
    deletedAt: world.deletedAt,
    origin: world.origin,
  }
}

/**
 * Writes a merged snapshot back. Rows are replaced one by one rather than the
 * tables being cleared first, so a failure part-way leaves the database holding
 * a mixture of two good states rather than nothing at all.
 */
export async function applySnapshot(snapshot: Snapshot): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.worlds,
      db.foldersById,
      db.folderOrder,
      db.hiddenWorlds,
      db.memos,
      db.customTags,
      db.launchedInstances,
    ],
    async () => {
      for (const folder of snapshot.folders) {
        await db.foldersById.put(folder)
      }
      await db.folderOrder.put({
        key: FOLDER_ORDER_KEY,
        ids: snapshot.folderOrder.ids,
        updatedAt: snapshot.folderOrder.updatedAt,
        origin: snapshot.folderOrder.origin,
      })
      for (const world of snapshot.worlds) {
        await db.worlds.put(
          toWorldRecord(world, await db.worlds.get(world.worldId)),
        )
      }
      for (const hidden of snapshot.hiddenWorlds) {
        await db.hiddenWorlds.put(hidden)
      }
      for (const memo of snapshot.memos) {
        await db.memos.put(memo)
      }
      for (const record of snapshot.customTags) {
        await db.customTags.put(record)
      }
      // A file written before this field existed carries none, which is not the
      // same as carrying an empty list: `parseBackupFile` fills it in, and the
      // merge unions, so nothing here is ever removed by an older backup.
      for (const instance of snapshot.launchedInstances) {
        await db.launchedInstances.put(instance)
      }
    },
  )

  // Settings live in local storage rather than in Dexie, so they are written
  // after the transaction commits: there is nothing to roll them back with,
  // and writing them first would leave them describing data that never landed.
  //
  // The device id is read here rather than taken from `snapshot.deviceId`,
  // which is whatever the file said when this is a backup being restored.
  const forced = shouldObeySettingsOverride(
    snapshot.settingsOverride,
    await deviceId(),
  )
  writeSettingEntries(
    selectSettingsToApply(
      snapshot.settings,
      readSettingEntries(),
      readSettingSyncOverrides(),
      forced,
    ),
  )
  if (forced && snapshot.settingsOverride !== null) {
    rememberAppliedSettingsOverride(snapshot.settingsOverride.at)
  }
}

export class UnreadableBackupError extends Error {}

/**
 * Reads a backup file as a snapshot, whichever of the two shapes it has.
 *
 * A file written before sync existed has no timestamps at all, so every row in
 * it is marked "time unknown" -- which is what makes taking one in add to the
 * current data rather than replace it.
 */
export function parseBackupFile(text: string, forDeviceId: string): Snapshot {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new UnreadableBackupError('The file is not JSON')
  }

  if (isLegacyBackup(parsed)) {
    return fromLegacyBackup(parsed as LegacyBackup, {
      deviceId: forDeviceId,
      newId: () => crypto.randomUUID(),
    })
  }

  const candidate = parsed as Partial<Snapshot>
  if (
    candidate.formatVersion !== SNAPSHOT_FORMAT_VERSION ||
    !Array.isArray(candidate.worlds) ||
    !Array.isArray(candidate.folders)
  ) {
    throw new UnreadableBackupError('The file is not a backup of this app')
  }

  return {
    ...emptySnapshot(forDeviceId),
    ...candidate,
  } as Snapshot
}
