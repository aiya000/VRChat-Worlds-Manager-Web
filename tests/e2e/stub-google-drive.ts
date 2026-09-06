import type { Page } from '@playwright/test'

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

export interface FakeDriveFile {
  id: string
  name: string
  parents: string[]
  mimeType: string
  /** Drive's own counter. Anything that writes bumps it, same as the real one. */
  version: number
  content: string
}

export interface FakeDrive {
  files: FakeDriveFile[]
  named: (name: string) => FakeDriveFile | undefined
  /** Writes to a file as if a second device had, so the version moves on. */
  writeFrom: (name: string, content: string) => void
  /** Makes every later call answer 401, the way an hour-old token does. */
  expireToken: () => void
  /**
   * Runs just after a file's content has been served. The hook to hang a
   * second device off: writing here happens inside the window between the app
   * reading the file and checking whether it still owns the write.
   */
  afterRead: ((file: FakeDriveFile) => void) | null
}

function fieldOf(query: string, pattern: RegExp): string | null {
  return query.match(pattern)?.[1] ?? null
}

/** Pulls the two JSON parts out of the multipart body Drive is sent on create. */
function parseMultipart(
  body: string,
  boundary: string,
): { metadata: { name: string; parents?: string[] }; content: string } {
  const parts = body
    .split(`--${boundary}`)
    .map((part) => part.split('\r\n\r\n').slice(1).join('\r\n\r\n').trim())
    .filter((part) => part.length > 0 && part !== '--')

  return { metadata: JSON.parse(parts[0]), content: parts[1] }
}

/**
 * Stands in for the Drive v3 REST API.
 *
 * `drive.file` means the real Drive only ever answers about files this app
 * made, so a store that starts empty and only ever holds what the app put
 * there is the same thing from the app's side.
 */
export async function stubGoogleDrive(
  page: Page,
  seed: FakeDriveFile[] = [],
): Promise<FakeDrive> {
  const files: FakeDriveFile[] = [...seed]
  let nextId = files.length + 1
  let tokenExpired = false

  const drive: FakeDrive = {
    files,
    named: (name) => files.find((file) => file.name === name),
    writeFrom: (name, content) => {
      const file = files.find((f) => f.name === name)
      if (file === undefined) {
        throw new Error(`No such file in the fake Drive: ${name}`)
      }
      file.content = content
      file.version += 1
    },
    expireToken: () => {
      tokenExpired = true
    },
    afterRead: null,
  }

  await page.route('https://www.googleapis.com/**', async (route) => {
    if (tokenExpired) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Invalid Credentials' } }),
      })
      return
    }

    const request = route.request()
    const url = new URL(request.url())
    const json = (value: unknown) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(value),
      })

    const uploadId = url.pathname.match(/^\/upload\/drive\/v3\/files\/(.+)$/)
    if (uploadId !== null && request.method() === 'PATCH') {
      const file = files.find((f) => f.id === uploadId[1])
      if (file === undefined) {
        await route.fulfill({ status: 404, body: 'not found' })
        return
      }
      file.content = request.postData() ?? ''
      file.version += 1
      await json({ id: file.id, version: String(file.version) })
      return
    }

    if (
      url.pathname === '/upload/drive/v3/files' &&
      request.method() === 'POST'
    ) {
      const boundary = (request.headers()['content-type'] ?? '').split(
        'boundary=',
      )[1]
      const { metadata, content } = parseMultipart(
        request.postData() ?? '',
        boundary,
      )
      const created: FakeDriveFile = {
        id: `file-${nextId++}`,
        name: metadata.name,
        parents: metadata.parents ?? [],
        mimeType: 'application/json',
        version: 1,
        content,
      }
      files.push(created)
      await json({ id: created.id, version: String(created.version) })
      return
    }

    const fileId = url.pathname.match(/^\/drive\/v3\/files\/(.+)$/)
    if (fileId !== null && request.method() === 'GET') {
      const file = files.find((f) => f.id === fileId[1])
      if (file === undefined) {
        await route.fulfill({ status: 404, body: 'not found' })
        return
      }
      if (url.searchParams.get('alt') === 'media') {
        const served = file.content
        await route.fulfill({ contentType: 'application/json', body: served })
        drive.afterRead?.(file)
        return
      }
      await json({ id: file.id, version: String(file.version) })
      return
    }

    if (url.pathname === '/drive/v3/files' && request.method() === 'POST') {
      const metadata = JSON.parse(request.postData() ?? '{}')
      const created: FakeDriveFile = {
        id: `folder-${nextId++}`,
        name: metadata.name,
        parents: [],
        mimeType: metadata.mimeType,
        version: 1,
        content: '',
      }
      files.push(created)
      await json({ id: created.id })
      return
    }

    if (url.pathname === '/drive/v3/files' && request.method() === 'GET') {
      const query = url.searchParams.get('q') ?? ''
      const name = fieldOf(query, /name = '([^']*)'/)
      const parent = fieldOf(query, /'([^']*)' in parents/)
      const wantsFolder = query.includes(FOLDER_MIME_TYPE)

      const found = files.filter(
        (file) =>
          file.name === name &&
          (wantsFolder
            ? file.mimeType === FOLDER_MIME_TYPE
            : file.mimeType !== FOLDER_MIME_TYPE) &&
          (parent === null || file.parents.includes(parent)),
      )
      await json({
        files: found.map((file) => ({
          id: file.id,
          version: String(file.version),
        })),
      })
      return
    }

    await route.fulfill({ status: 404, body: `unexpected: ${request.url()}` })
  })

  return drive
}
