import { Context, Effect, Layer } from 'effect'
import type { BackupMetaData } from '@/lib/types'
import { mergeSnapshot } from '@/lib/sync/merge'
import type { Snapshot } from '@/lib/sync/types'
import { db, type SyncMeta } from './db'
import { deviceId } from './sync-meta'
import {
  applySnapshot,
  parseBackupFile,
  readSnapshot,
  UnreadableBackupError,
} from './snapshot'

/**
 * How an incoming backup meets what is already here.
 *
 * `merge` is the one to reach for: it adds what the backup knows and takes
 * nothing away, so a backup from last month cannot remove a folder made since.
 * `replace` is the old behaviour, kept for when someone really does mean to
 * throw the current data out.
 */
export type RestoreMode = 'merge' | 'replace'

export class BackupService extends Context.Tag('BackupService')<
  BackupService,
  {
    readonly createBackup: () => Effect.Effect<void, Error>
    readonly restoreFromBackup: (
      file: File,
      mode: RestoreMode,
    ) => Effect.Effect<void, Error>
    readonly getBackupMetadataFromFile: (
      file: File,
    ) => Effect.Effect<BackupMetaData, Error>
  }
>() {}

function download(contents: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(contents, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Marks every row as written here and now, which is what replacing means. */
function restamped(snapshot: Snapshot, at: number, origin: string): Snapshot {
  const meta = (row: SyncMeta): SyncMeta => ({
    updatedAt: at,
    deletedAt: row.deletedAt === null ? null : at,
    origin,
  })

  return {
    ...snapshot,
    worlds: snapshot.worlds.map((row) => ({ ...row, ...meta(row) })),
    folders: snapshot.folders.map((row) => ({ ...row, ...meta(row) })),
    folderOrder: { ...snapshot.folderOrder, updatedAt: at, origin },
    hiddenWorlds: snapshot.hiddenWorlds.map((row) => ({
      ...row,
      ...meta(row),
    })),
    memos: snapshot.memos.map((row) => ({ ...row, ...meta(row) })),
    customTags: snapshot.customTags.map((row) => ({ ...row, ...meta(row) })),
    launchedInstances: snapshot.launchedInstances.map((row) => ({
      ...row,
      ...meta(row),
    })),
    // Settings are restamped too, or "replace with this file" would quietly
    // keep the settings already here whenever they happened to be newer.
    settings: Object.fromEntries(
      Object.entries(snapshot.settings).map(([key, setting]) => [
        key,
        { ...setting, updatedAt: at },
      ]),
    ),
  }
}

async function clearUserData(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.worlds,
      db.foldersById,
      db.folderOrder,
      db.hiddenWorlds,
      db.memos,
      db.customTags,
    ],
    async () => {
      await db.worlds.clear()
      await db.foldersById.clear()
      await db.folderOrder.clear()
      await db.hiddenWorlds.clear()
      await db.memos.clear()
      await db.customTags.clear()
    },
  )
}

export const BackupServiceLive = Layer.succeed(BackupService, {
  createBackup: () =>
    Effect.tryPromise({
      try: async () => {
        const snapshot = await readSnapshot()
        download(
          snapshot,
          `vrcww-backup-${new Date().toISOString().slice(0, 10)}.json`,
        )
      },
      catch: (e) => new Error(`Failed to create backup: ${e}`),
    }),

  restoreFromBackup: (file, mode) =>
    Effect.tryPromise({
      try: async () => {
        const origin = await deviceId()
        const incoming = parseBackupFile(await file.text(), origin)

        if (mode === 'replace') {
          await clearUserData()
          await applySnapshot(restamped(incoming, Date.now(), origin))
          return
        }

        // The whole of this feature: the same merge the sync will use. A
        // backup with no timestamps is all unknowns, and unknowns are unioned
        // rather than resolved, so nothing made since it was taken is lost.
        const { snapshot } = mergeSnapshot(await readSnapshot(), incoming)
        await applySnapshot(snapshot)
      },
      catch: (e) =>
        e instanceof UnreadableBackupError
          ? e
          : new Error(`Failed to restore backup: ${e}`),
    }),

  getBackupMetadataFromFile: (file) =>
    Effect.tryPromise({
      try: async () => {
        const snapshot = parseBackupFile(await file.text(), await deviceId())
        return snapshot.metadata
      },
      catch: (e) =>
        e instanceof UnreadableBackupError
          ? e
          : new Error(`Failed to read backup metadata: ${e}`),
    }),
})
