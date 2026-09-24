/**
 * The slice of the Drive v3 REST API this app needs, and nothing more.
 *
 * Every call here is made with the `drive.file` scope, which means Drive only
 * ever answers about files this app itself created. Searching is therefore
 * safe to do broadly: a folder someone else made with the same name is simply
 * not visible.
 *
 * Every call also takes the `signal` of the sync it belongs to, so a person
 * can stop a sync that has stalled (#221), and every call gives up on its own
 * after `DRIVE_REQUEST_TIMEOUT_MS` (#220).
 */

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
const JSON_MIME_TYPE = 'application/json'

export const SYNC_FOLDER_NAME = 'VRChat Worlds Manager'
export const SYNC_FILE_NAME = 'vrcww-sync.json'
export const SYNC_BACKUP_FILE_NAME = 'vrcww-sync.bak.json'

/**
 * How long one request may go without finishing, body included.
 *
 * A half-megabyte upload was seen taking 17 seconds on a phone that was
 * working, and another one answering nothing at all for more than four
 * minutes (#220). A minute is well clear of the first and still short enough
 * that the second ends while the person is waiting on it.
 */
export const DRIVE_REQUEST_TIMEOUT_MS = 60_000

/**
 * `version` is Drive's own counter for the file, bumped on every write. Two
 * devices writing at once is detected by it changing between the read and the
 * write, which is the whole of the optimistic retry.
 */
export interface DriveFile {
  id: string
  version: string
}

export class DriveApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/**
 * A request that went unanswered for `DRIVE_REQUEST_TIMEOUT_MS`.
 *
 * Whether Drive went on to carry out a write that timed out is unknown. That
 * is safe for the sync file: the next sync reads it again and merges against
 * whatever is there, and nothing on this device was changed yet.
 */
export class DriveTimeoutError extends Error {}

/** Drive's search syntax has no parameter binding; a name is spliced in raw. */
function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/**
 * One request, answered and read within the time limit, or abandoned.
 *
 * The timer stays running until `read` has the body: `fetch` resolves as soon
 * as the headers arrive, and a body that stops arriving is the same stall.
 */
async function driveRequest<T>(
  token: string,
  url: string,
  init: RequestInit,
  read: (response: Response) => Promise<T>,
  signal: AbortSignal | undefined,
): Promise<T> {
  // By hand rather than `AbortSignal.any`/`AbortSignal.timeout`: the browsers
  // built into VR overlays lag behind Chrome, and these are recent.
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, DRIVE_REQUEST_TIMEOUT_MS)
  const forwardAbort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', forwardAbort)

  try {
    signal?.throwIfAborted()
    const response = await fetch(url, {
      ...init,
      headers: { ...init.headers, Authorization: `Bearer ${token}` },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new DriveApiError(
        response.status,
        `Google Drive answered ${response.status}: ${await response.text()}`,
      )
    }
    return await read(response)
  } catch (e) {
    if (timedOut) {
      throw new DriveTimeoutError(
        `Google Drive did not answer within ${DRIVE_REQUEST_TIMEOUT_MS / 1000} seconds`,
      )
    }
    signal?.throwIfAborted()
    throw e
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', forwardAbort)
  }
}

async function findByQuery(
  token: string,
  query: string,
  pageSize: number,
  signal: AbortSignal | undefined,
): Promise<DriveFile[]> {
  const url =
    `${DRIVE_FILES}?q=${encodeURIComponent(query)}` +
    `&spaces=drive&pageSize=${pageSize}&fields=files(id,version)`
  const { files } = await driveRequest(
    token,
    url,
    {},
    (response) => response.json() as Promise<{ files?: DriveFile[] }>,
    signal,
  )
  return files ?? []
}

function fileQuery(folderId: string, name: string): string {
  return `name = ${quote(name)} and ${quote(folderId)} in parents and trashed = false`
}

export async function findFolder(
  token: string,
  name: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const [found] = await findByQuery(
    token,
    `name = ${quote(name)} and mimeType = ${quote(FOLDER_MIME_TYPE)} and trashed = false`,
    1,
    signal,
  )
  return found?.id ?? null
}

export async function createFolder(
  token: string,
  name: string,
  signal?: AbortSignal,
): Promise<string> {
  const { id } = await driveRequest(
    token,
    `${DRIVE_FILES}?fields=id`,
    {
      method: 'POST',
      headers: { 'Content-Type': JSON_MIME_TYPE },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME_TYPE }),
    },
    (response) => response.json() as Promise<{ id: string }>,
    signal,
  )
  return id
}

export async function findOrCreateFolder(
  token: string,
  name: string,
  signal?: AbortSignal,
): Promise<string> {
  return (
    (await findFolder(token, name, signal)) ??
    (await createFolder(token, name, signal))
  )
}

export async function findFile(
  token: string,
  folderId: string,
  name: string,
  signal?: AbortSignal,
): Promise<DriveFile | null> {
  const [found] = await findByQuery(token, fileQuery(folderId, name), 1, signal)
  return found ?? null
}

export async function readFile(
  token: string,
  fileId: string,
  signal?: AbortSignal,
): Promise<string> {
  return driveRequest(
    token,
    `${DRIVE_FILES}/${fileId}?alt=media`,
    {},
    (response) => response.text(),
    signal,
  )
}

/**
 * The file's current `version`, or `null` if it is gone. Read immediately
 * before a write to find out whether another device got there first.
 */
export async function fileVersion(
  token: string,
  fileId: string,
  signal?: AbortSignal,
): Promise<string | null> {
  try {
    const { version } = await driveRequest(
      token,
      `${DRIVE_FILES}/${fileId}?fields=version`,
      {},
      (response) => response.json() as Promise<{ version: string }>,
      signal,
    )
    return version
  } catch (e) {
    if (e instanceof DriveApiError && e.status === 404) {
      return null
    }
    throw e
  }
}

/** A metadata part and a content part, which is what Drive wants for a create. */
function multipartBody(
  metadata: unknown,
  content: string,
  boundary: string,
): string {
  return [
    `--${boundary}`,
    `Content-Type: ${JSON_MIME_TYPE}; charset=UTF-8`,
    '',
    JSON.stringify(metadata),
    `--${boundary}`,
    `Content-Type: ${JSON_MIME_TYPE}; charset=UTF-8`,
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

export async function createFile(
  token: string,
  folderId: string,
  name: string,
  content: string,
  signal?: AbortSignal,
): Promise<DriveFile> {
  const boundary = `vrcww-${crypto.randomUUID()}`
  return driveRequest(
    token,
    `${DRIVE_UPLOAD}?uploadType=multipart&fields=id,version`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody({ name, parents: [folderId] }, content, boundary),
    },
    (response) => response.json() as Promise<DriveFile>,
    signal,
  )
}

export async function updateFile(
  token: string,
  fileId: string,
  content: string,
  signal?: AbortSignal,
): Promise<DriveFile> {
  return driveRequest(
    token,
    `${DRIVE_UPLOAD}/${fileId}?uploadType=media&fields=id,version`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': JSON_MIME_TYPE },
      body: content,
    },
    (response) => response.json() as Promise<DriveFile>,
    signal,
  )
}

async function deleteFile(
  token: string,
  fileId: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  await driveRequest(
    token,
    `${DRIVE_FILES}/${fileId}`,
    { method: 'DELETE' },
    async () => {},
    signal,
  )
}

/**
 * Makes `name` in `folderId` a copy of `sourceId`, made inside Drive.
 *
 * Nothing is uploaded: the backup used to be the downloaded text sent straight
 * back, a second half-megabyte upload per sync and the one that stalled
 * (#220). Drive's copy always makes a new file, so the copies it replaces are
 * deleted once the new one exists -- never before, so there is no moment with
 * no backup at all.
 */
export async function replaceWithCopy(
  token: string,
  sourceId: string,
  folderId: string,
  name: string,
  signal?: AbortSignal,
): Promise<void> {
  const previous = await findByQuery(
    token,
    fileQuery(folderId, name),
    10,
    signal,
  )
  await driveRequest(
    token,
    `${DRIVE_FILES}/${sourceId}/copy?fields=id`,
    {
      method: 'POST',
      headers: { 'Content-Type': JSON_MIME_TYPE },
      body: JSON.stringify({ name, parents: [folderId] }),
    },
    (response) => response.json(),
    signal,
  )
  for (const file of previous) {
    await deleteFile(token, file.id, signal)
  }
}
