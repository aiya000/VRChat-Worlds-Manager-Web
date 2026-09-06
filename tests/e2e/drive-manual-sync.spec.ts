import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedFolders } from './seed-folders'
import { stubGoogleDrive, type FakeDriveFile } from './stub-google-drive'
import { stubGoogleIdentityServices } from './stub-google-identity'

const SETTINGS = '/listview/settings'
const LIST_VIEW = '/listview/folders/special/all'

const SYNC_FOLDER = 'VRChat Worlds Manager'
const SYNC_FILE = 'vrcww-sync.json'
const BACKUP_FILE = 'vrcww-sync.bak.json'

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

const REMOTE_ONLY_FOLDER = 'Driveにだけあるフォルダ'
const LOCAL_ONLY_FOLDER = 'この端末で作ったフォルダ'

/**
 * What is already on Drive, in the shape releases before 2.2.0 wrote: no
 * timestamps at all. That is the harder case, not a lazier one -- with nothing
 * to compare, the merge has to union rather than pick a winner, so a folder
 * this device has never heard of has to survive.
 */
const REMOTE_SNAPSHOT = {
  metadata: {
    date: '2025-03-01T00:00:00.000Z',
    number_of_folders: 1,
    number_of_worlds: 1,
    app_version: '2.0.0',
  },
  worlds: [
    {
      worldId: 'wrld_from_drive',
      name: 'World From Drive',
      thumbnailUrl: 'https://example.invalid/thumb.png',
      authorName: 'someone',
      favorites: 1,
      lastUpdated: '2025-02-01',
      visits: 2,
      dateAdded: '2025-02-01T00:00:00.000Z',
      platform: ['standalonewindows'],
      folders: [REMOTE_ONLY_FOLDER],
      tags: [],
      capacity: 16,
    },
  ],
  folders: [{ name: REMOTE_ONLY_FOLDER, world_count: 1 }],
  hiddenWorlds: [],
  memos: {},
  customTags: {},
}

function driveHolding(content: string): FakeDriveFile[] {
  return [
    {
      id: 'folder-1',
      name: SYNC_FOLDER,
      parents: [],
      mimeType: FOLDER_MIME_TYPE,
      version: 1,
      content: '',
    },
    {
      id: 'file-1',
      name: SYNC_FILE,
      parents: ['folder-1'],
      mimeType: 'application/json',
      version: 1,
      content,
    },
  ]
}

async function openSyncTab(page: Page) {
  await page.goto(SETTINGS)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page
    .getByRole('tab', { name: jaJP['settings-page:section-sync'] })
    .click()
}

async function connect(page: Page) {
  await openSyncTab(page)
  await page
    .getByRole('button', { name: jaJP['settings-page:google-drive-connect'] })
    .click()
  await expect(
    page.getByRole('button', {
      name: jaJP['settings-page:google-drive-sync-now'],
    }),
  ).toBeVisible()
}

async function syncNow(page: Page) {
  await page
    .getByRole('button', { name: jaJP['settings-page:google-drive-sync-now'] })
    .click()
}

async function folderNames(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('VRChatWorldsManager')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const rows = await new Promise<
      { name: string; deletedAt: number | null }[]
    >((resolve, reject) => {
      const request = db
        .transaction('foldersById', 'readonly')
        .objectStore('foldersById')
        .getAll()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return rows
      .filter((row) => row.deletedAt === null)
      .map((row) => row.name)
      .sort()
  })
}

test.describe('syncing with Google Drive by hand', () => {
  test.beforeEach(async ({ page }) => {
    await stubGoogleIdentityServices(page, { token: 'test-access-token' })
    await page.goto(LIST_VIEW)
    await seedFolders(page, [LOCAL_ONLY_FOLDER])
  })

  test('creates the file when Drive has nothing yet', async ({ page }) => {
    const drive = await stubGoogleDrive(page)

    await connect(page)
    await syncNow(page)

    await expect(
      page.getByText(jaJP['settings-page:google-drive-sync-success']),
    ).toBeVisible()

    const written = drive.named(SYNC_FILE)
    expect(written).toBeDefined()
    expect(JSON.parse(written!.content).formatVersion).toBe(2)
    expect(drive.named(SYNC_FOLDER)?.mimeType).toBe(FOLDER_MIME_TYPE)
    // Nothing to have kept a previous generation of.
    expect(drive.named(BACKUP_FILE)).toBeUndefined()
  })

  test('takes on a folder only Drive knew about, and keeps its own', async ({
    page,
  }) => {
    await stubGoogleDrive(page, driveHolding(JSON.stringify(REMOTE_SNAPSHOT)))

    await connect(page)
    await syncNow(page)
    await expect(
      page.getByText(jaJP['settings-page:google-drive-sync-success']),
    ).toBeVisible()

    expect(await folderNames(page)).toEqual(
      [REMOTE_ONLY_FOLDER, LOCAL_ONLY_FOLDER].sort(),
    )
  })

  test('sends its own folder up, so the other device can have it', async ({
    page,
  }) => {
    const drive = await stubGoogleDrive(
      page,
      driveHolding(JSON.stringify(REMOTE_SNAPSHOT)),
    )

    await connect(page)
    await syncNow(page)
    await expect(
      page.getByText(jaJP['settings-page:google-drive-sync-success']),
    ).toBeVisible()

    const uploaded = JSON.parse(drive.named(SYNC_FILE)!.content)
    expect(
      uploaded.folders.map((f: { name: string }) => f.name).sort(),
    ).toEqual([REMOTE_ONLY_FOLDER, LOCAL_ONLY_FOLDER].sort())
  })

  test('keeps the file it replaced, one generation back', async ({ page }) => {
    const before = JSON.stringify(REMOTE_SNAPSHOT)
    const drive = await stubGoogleDrive(page, driveHolding(before))

    await connect(page)
    await syncNow(page)
    await expect(
      page.getByText(jaJP['settings-page:google-drive-sync-success']),
    ).toBeVisible()

    expect(drive.named(BACKUP_FILE)?.content).toBe(before)
  })

  test('merges again when another device wrote first', async ({ page }) => {
    const drive = await stubGoogleDrive(
      page,
      driveHolding(JSON.stringify(REMOTE_SNAPSHOT)),
    )

    let reads = 0
    drive.afterRead = (file) => {
      reads += 1
      // Once, and in the window the retry exists for: the app has the file's
      // contents but has not yet checked that it still owns the next write.
      if (reads === 1) {
        file.version += 1
      }
    }

    await connect(page)
    await syncNow(page)

    await expect(
      page.getByText(jaJP['settings-page:google-drive-sync-success']),
    ).toBeVisible()
    expect(reads).toBeGreaterThan(1)
    expect(await folderNames(page)).toEqual(
      [REMOTE_ONLY_FOLDER, LOCAL_ONLY_FOLDER].sort(),
    )
  })

  test('asks for another press once the token has expired', async ({
    page,
  }) => {
    const drive = await stubGoogleDrive(page)

    await connect(page)
    drive.expireToken()
    await syncNow(page)

    await expect(
      page.getByText(jaJP['settings-page:google-drive-reauth-needed']),
    ).toBeVisible()
  })

  test('says when it last synced, having said it never had', async ({
    page,
  }) => {
    await stubGoogleDrive(page)

    await connect(page)
    await expect(
      page.getByText(jaJP['settings-page:google-drive-never-synced']),
    ).toBeVisible()

    await syncNow(page)

    await expect(
      page.getByText(jaJP['settings-page:google-drive-never-synced']),
    ).toBeHidden()
  })

  test('shows how far along it is, and says not to reload', async ({
    page,
  }) => {
    const drive = await stubGoogleDrive(page)

    // Held open on the first Drive call so the in-progress state can be read.
    // Without this the whole sync is over before an assertion can run.
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    let firstCall = true
    await page.route('https://www.googleapis.com/**', async (route) => {
      if (firstCall) {
        firstCall = false
        await held
      }
      await route.fallback()
    })

    await connect(page)
    await syncNow(page)

    await expect(page.getByText(/^\d+% — /)).toBeVisible()
    await expect(
      page.getByText(jaJP['settings-page:google-drive-do-not-reload']),
    ).toBeVisible()

    release()
    await expect(
      page.getByText(jaJP['settings-page:google-drive-sync-success']),
    ).toBeVisible()
    expect(drive.named(SYNC_FILE)).toBeDefined()
  })
})

test.describe('opened from the home screen', () => {
  /**
   * There is no way to ask Playwright for an installed app, so the one signal
   * the code reads is answered directly. `display-mode: standalone` is what a
   * browser reports for a page launched from the home screen.
   */
  async function pretendInstalled(page: Page) {
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window)
      window.matchMedia = (query: string) =>
        query.includes('display-mode: standalone')
          ? ({
              matches: true,
              media: query,
              addEventListener: () => {},
              removeEventListener: () => {},
              addListener: () => {},
              removeListener: () => {},
              onchange: null,
              dispatchEvent: () => false,
            } as MediaQueryList)
          : real(query)
    })
  }

  test('warns before the button rather than after the wait', async ({
    page,
  }) => {
    await pretendInstalled(page)
    await stubGoogleIdentityServices(page, { token: 'test-access-token' })
    await stubGoogleDrive(page)
    await page.goto(LIST_VIEW)
    await openSyncTab(page)

    await expect(
      page.getByText(jaJP['settings-page:google-drive-installed-warning']),
    ).toBeVisible()
  })

  test('says nothing of the sort in an ordinary tab', async ({ page }) => {
    await stubGoogleIdentityServices(page, { token: 'test-access-token' })
    await stubGoogleDrive(page)
    await page.goto(LIST_VIEW)
    await openSyncTab(page)

    await expect(
      page.getByText(jaJP['settings-page:google-drive-installed-warning']),
    ).toBeHidden()
  })
})

test.describe('when Google never grants the token', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIST_VIEW)
    await seedFolders(page, [LOCAL_ONLY_FOLDER])
  })

  // The failure that started all of this: with no `error_callback` and no
  // timeout, a window that closed left the screen on "syncing" forever.
  test('says the window was closed rather than syncing forever', async ({
    page,
  }) => {
    await stubGoogleIdentityServices(page, { token: 'test-access-token' })
    await stubGoogleDrive(page)
    await connect(page)

    // Connecting spent the token the stub hands out; the sync asks for another
    // one, and this time the window closes instead of answering.
    await stubGoogleIdentityServices(page, { dismissed: 'popup_closed' })
    await page.reload()
    // The dev server's overlay comes back with the reload, and it swallows
    // clicks meant for the tab underneath it.
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })
    await page
      .getByRole('tab', { name: jaJP['settings-page:section-sync'] })
      .click()
    await syncNow(page)

    await expect(
      page.getByText(jaJP['settings-page:google-drive-dismissed']),
    ).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: jaJP['settings-page:google-drive-sync-now'],
      }),
    ).toBeEnabled()
  })
})
