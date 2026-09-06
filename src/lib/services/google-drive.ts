/**
 * The slice of the Drive v3 REST API this app needs, and nothing more.
 *
 * Every call here is made with the `drive.file` scope, which means Drive only
 * ever answers about files this app itself created. Searching is therefore
 * safe to do broadly: a folder someone else made with the same name is simply
 * not visible.
 */

const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files'
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'
const JSON_MIME_TYPE = 'application/json'

export const SYNC_FOLDER_NAME = 'VRChat Worlds Manager'
export const SYNC_FILE_NAME = 'vrcww-sync.json'
export const SYNC_BACKUP_FILE_NAME = 'vrcww-sync.bak.json'

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

/** Drive's search syntax has no parameter binding; a name is spliced in raw. */
function quote(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

async function driveFetch(
  token: string,
  url: string,
  init: RequestInit = {},
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new DriveApiError(
      response.status,
      `Google Drive answered ${response.status}: ${await response.text()}`,
    )
  }
  return response
}

async function findByQuery(
  token: string,
  query: string,
): Promise<DriveFile | null> {
  const url =
    `${DRIVE_FILES}?q=${encodeURIComponent(query)}` +
    '&spaces=drive&pageSize=1&fields=files(id,version)'
  const { files } = (await (await driveFetch(token, url)).json()) as {
    files?: DriveFile[]
  }
  return files?.[0] ?? null
}

export async function findFolder(
  token: string,
  name: string,
): Promise<string | null> {
  const found = await findByQuery(
    token,
    `name = ${quote(name)} and mimeType = ${quote(FOLDER_MIME_TYPE)} and trashed = false`,
  )
  return found?.id ?? null
}

export async function createFolder(
  token: string,
  name: string,
): Promise<string> {
  const response = await driveFetch(token, `${DRIVE_FILES}?fields=id`, {
    method: 'POST',
    headers: { 'Content-Type': JSON_MIME_TYPE },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME_TYPE }),
  })
  const { id } = (await response.json()) as { id: string }
  return id
}

export async function findOrCreateFolder(
  token: string,
  name: string,
): Promise<string> {
  return (await findFolder(token, name)) ?? (await createFolder(token, name))
}

export async function findFile(
  token: string,
  folderId: string,
  name: string,
): Promise<DriveFile | null> {
  return findByQuery(
    token,
    `name = ${quote(name)} and ${quote(folderId)} in parents and trashed = false`,
  )
}

export async function readFile(token: string, fileId: string): Promise<string> {
  return (await driveFetch(token, `${DRIVE_FILES}/${fileId}?alt=media`)).text()
}

/**
 * The file's current `version`, or `null` if it is gone. Read immediately
 * before a write to find out whether another device got there first.
 */
export async function fileVersion(
  token: string,
  fileId: string,
): Promise<string | null> {
  try {
    const response = await driveFetch(
      token,
      `${DRIVE_FILES}/${fileId}?fields=version`,
    )
    const { version } = (await response.json()) as { version: string }
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
): Promise<DriveFile> {
  const boundary = `vrcww-${crypto.randomUUID()}`
  const response = await driveFetch(
    token,
    `${DRIVE_UPLOAD}?uploadType=multipart&fields=id,version`,
    {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody({ name, parents: [folderId] }, content, boundary),
    },
  )
  return (await response.json()) as DriveFile
}

export async function updateFile(
  token: string,
  fileId: string,
  content: string,
): Promise<DriveFile> {
  const response = await driveFetch(
    token,
    `${DRIVE_UPLOAD}/${fileId}?uploadType=media&fields=id,version`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': JSON_MIME_TYPE },
      body: content,
    },
  )
  return (await response.json()) as DriveFile
}

/**
 * Writes `content` to `name` in `folderId`, whether or not it is already there.
 */
export async function writeFile(
  token: string,
  folderId: string,
  name: string,
  content: string,
): Promise<DriveFile> {
  const existing = await findFile(token, folderId, name)
  return existing === null
    ? createFile(token, folderId, name, content)
    : updateFile(token, existing.id, content)
}
