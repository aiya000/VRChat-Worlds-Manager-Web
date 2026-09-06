import { Context, Effect, Layer } from 'effect'
import { mergeSnapshot } from '@/lib/sync/merge'
import type { Snapshot } from '@/lib/sync/types'
import { db } from './db'
import {
  forgetAccessToken,
  GoogleAuthExpiredError,
} from './google-auth-service'
import {
  createFile,
  DriveApiError,
  type DriveFile,
  findFile,
  findOrCreateFolder,
  fileVersion,
  readFile,
  SYNC_BACKUP_FILE_NAME,
  SYNC_FILE_NAME,
  SYNC_FOLDER_NAME,
  updateFile,
  writeFile,
} from './google-drive'
import { asRemoteWrite } from './local-changes'
import { clearPendingSettingsOverride } from './setting-sync'
import { applySnapshot, parseBackupFile, readSnapshot } from './snapshot'
import { deviceId } from './sync-meta'

const LAST_SYNCED_AT_KEY = 'driveLastSyncedAt'

/**
 * The file this device last agreed with, and the `version` it was at when it
 * did. Kept so the poll can ask "has anyone written since?" with one small
 * request, rather than downloading a snapshot a minute to find out.
 */
const REMOTE_FILE_ID_KEY = 'driveRemoteFileId'
const REMOTE_VERSION_KEY = 'driveRemoteVersion'

/**
 * How many times to redo the merge when another device wrote to the file
 * first. Three is not a considered number so much as a bound: each retry only
 * happens when two devices press sync within a second or two of each other,
 * and a fourth collision in a row is better reported than looped on.
 */
const MAX_ATTEMPTS = 3

/**
 * The steps a sync goes through, in the order it goes through them.
 *
 * They are reported so the screen can show which one it is on and how far
 * along that is. A sync that has stopped is otherwise indistinguishable from a
 * slow one, and the first time this went wrong it sat on "syncing" with
 * nothing to say whether anything was happening at all.
 */
export const SYNC_STEPS = [
  'authorizing',
  'locating',
  'downloading',
  'merging',
  'backingUp',
  'uploading',
  'applying',
] as const

export type SyncStep = (typeof SYNC_STEPS)[number]

export type SyncProgress = (step: SyncStep) => void

/** How far through `SYNC_STEPS` a step is, as a whole percentage. */
export function syncStepPercentage(step: SyncStep): number {
  return Math.round(((SYNC_STEPS.indexOf(step) + 1) / SYNC_STEPS.length) * 100)
}

export interface SyncOutcome {
  syncedAt: number
  /**
   * How many memos had two different texts and lost one. The list of what was
   * set aside is PR-H's job; the count is here so the button can at least say
   * that it happened.
   */
  memoConflicts: number
}

/**
 * What the settings screen gets back. An expired token is an outcome rather
 * than an error: there is nothing wrong, the user simply has to press again,
 * and saying so needs a case the UI can recognise rather than a message.
 */
export type DriveSyncResult =
  | ({ kind: 'synced' } & SyncOutcome)
  | { kind: 'reauth-needed' }
  /** The Google window was closed, or the browser refused to open it. */
  | { kind: 'dismissed' }
  /** It opened and never came back. See `GoogleAuthUnansweredError`. */
  | { kind: 'unanswered' }

export class SyncRaceLostError extends Error {}

export class DriveSyncService extends Context.Tag('DriveSyncService')<
  DriveSyncService,
  {
    readonly syncNow: (
      accessToken: string,
      onProgress: SyncProgress,
    ) => Effect.Effect<SyncOutcome, Error>
    readonly lastSyncedAt: () => Effect.Effect<number | null, Error>
    /**
     * Whether the file on Drive has moved on since this device last wrote it.
     *
     * `false` when there is nothing to compare against -- a device that has
     * never synced has nothing another one could have changed under it.
     */
    readonly remoteChanged: (
      accessToken: string,
    ) => Effect.Effect<boolean, Error>
  }
>() {}

function serialize(snapshot: Snapshot): string {
  return JSON.stringify(snapshot)
}

async function rememberSyncedAt(at: number): Promise<void> {
  await db.syncState.put({ key: LAST_SYNCED_AT_KEY, value: String(at) })
}

async function rememberRemote(file: DriveFile): Promise<void> {
  await db.syncState.put({ key: REMOTE_FILE_ID_KEY, value: file.id })
  await db.syncState.put({ key: REMOTE_VERSION_KEY, value: file.version })
}

async function lastKnownRemote(): Promise<DriveFile | null> {
  const [id, version] = await Promise.all([
    db.syncState.get(REMOTE_FILE_ID_KEY),
    db.syncState.get(REMOTE_VERSION_KEY),
  ])
  if (id === undefined || version === undefined) {
    return null
  }
  return { id: id.value, version: version.value }
}

/**
 * Pull, merge, push -- once, and only if nothing changed underneath.
 *
 * Returns `null` when another device wrote to the file between reading it and
 * writing it back, which means the merge was done against a file that no
 * longer exists and has to be done again against the new one.
 */
async function attemptSync(
  token: string,
  folderId: string,
  origin: string,
  onProgress: SyncProgress,
): Promise<SyncOutcome | null> {
  onProgress('locating')
  const remote = await findFile(token, folderId, SYNC_FILE_NAME)

  // Nothing up there yet: this device seeds the file, and there is nothing to
  // merge against or to keep a previous generation of.
  if (remote === null) {
    onProgress('uploading')
    const created = await createFile(
      token,
      folderId,
      SYNC_FILE_NAME,
      serialize(await readSnapshot()),
    )
    const syncedAt = Date.now()
    await rememberRemote(created)
    await rememberSyncedAt(syncedAt)
    clearPendingSettingsOverride()
    return { syncedAt, memoConflicts: 0 }
  }

  onProgress('downloading')
  const remoteText = await readFile(token, remote.id)

  onProgress('merging')
  const { snapshot, memoConflicts } = mergeSnapshot(
    await readSnapshot(),
    parseBackupFile(remoteText, origin),
  )

  if ((await fileVersion(token, remote.id)) !== remote.version) {
    return null
  }

  // The last thing anyone agreed on, kept one generation back. If a bug in the
  // merge ever eats something, this is what it can be recovered from -- and
  // `drive.file` means the user can open and download it themselves.
  onProgress('backingUp')
  await writeFile(token, folderId, SYNC_BACKUP_FILE_NAME, remoteText)

  onProgress('uploading')
  const written = await updateFile(token, remote.id, serialize(snapshot))

  // Not a local change: without this, writing the merge back would look like
  // an edit and schedule a push of what was just pulled, over and over.
  onProgress('applying')
  await asRemoteWrite(() => applySnapshot(snapshot))

  const syncedAt = Date.now()
  await rememberRemote(written)
  await rememberSyncedAt(syncedAt)
  // Only now: the demand is one press, and it has to stay pending through a
  // retry rather than being dropped by a sync that lost the race and never
  // reached the file.
  clearPendingSettingsOverride()
  return { syncedAt, memoConflicts: memoConflicts.length }
}

export const DriveSyncServiceLive = Layer.succeed(DriveSyncService, {
  syncNow: (accessToken, onProgress) =>
    Effect.tryPromise({
      try: async () => {
        onProgress('locating')
        const folderId = await findOrCreateFolder(accessToken, SYNC_FOLDER_NAME)
        const origin = await deviceId()

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
          const outcome = await attemptSync(
            accessToken,
            folderId,
            origin,
            onProgress,
          )
          if (outcome !== null) {
            return outcome
          }
        }

        throw new SyncRaceLostError(
          `Another device wrote to ${SYNC_FILE_NAME} on each of ${MAX_ATTEMPTS} attempts`,
        )
      },
      catch: (e) => {
        // The token was still in memory but Google had already retired it. A
        // replacement needs a gesture, and the one that started this sync is
        // over, so the honest answer is to ask for another press.
        if (e instanceof DriveApiError && e.status === 401) {
          forgetAccessToken()
          return new GoogleAuthExpiredError('The Google access token expired')
        }
        return e instanceof SyncRaceLostError
          ? e
          : new Error(`Failed to sync with Google Drive: ${e}`)
      },
    }),

  remoteChanged: (accessToken) =>
    Effect.tryPromise({
      try: async () => {
        const known = await lastKnownRemote()
        if (known === null) {
          return false
        }
        const current = await fileVersion(accessToken, known.id)
        // Gone means someone deleted or replaced the file, which a sync has to
        // find out about rather than keep polling a file that is not there.
        return current !== known.version
      },
      catch: (e) => {
        if (e instanceof DriveApiError && e.status === 401) {
          forgetAccessToken()
          return new GoogleAuthExpiredError('The Google access token expired')
        }
        return new Error(`Failed to check Google Drive for changes: ${e}`)
      },
    }),

  lastSyncedAt: () =>
    Effect.tryPromise({
      try: async () => {
        const row = await db.syncState.get(LAST_SYNCED_AT_KEY)
        if (row === undefined) {
          return null
        }
        const at = Number(row.value)
        return Number.isFinite(at) ? at : null
      },
      catch: (e) => new Error(`Failed to read the last sync time: ${e}`),
    }),
})
