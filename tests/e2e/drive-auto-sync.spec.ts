import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedFolders } from './seed-folders'
import { stubGoogleDrive, type FakeDriveFile } from './stub-google-drive'
import { stubGoogleIdentityServices } from './stub-google-identity'

const SETTINGS = '/listview/settings'
const LIST_VIEW = '/listview/folders/special/all'

const SYNC_FOLDER = 'VRChat Worlds Manager'
const SYNC_FILE = 'vrcww-sync.json'

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

const REMOTE_ONLY_FOLDER = 'Driveにだけあるフォルダ'
const LOCAL_ONLY_FOLDER = 'この端末で作ったフォルダ'
const MADE_AFTER_CONNECTING = 'あとから作ったフォルダ'

/** A file in the shape releases before sync wrote: no timestamps anywhere. */
const REMOTE_SNAPSHOT = {
  metadata: {
    date: '2025-03-01T00:00:00.000Z',
    number_of_folders: 1,
    number_of_worlds: 0,
    app_version: '2.0.0',
  },
  worlds: [],
  folders: [{ name: REMOTE_ONLY_FOLDER, world_count: 0 }],
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
  // The dev server's error overlay sits above everything and swallows clicks
  // meant for what is underneath it.
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

async function createFolder(page: Page, name: string) {
  await page.locator('[data-sidebar="trigger"]').click()
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  await drawer
    .getByText(jaJP['app-sidebar:add-folder'], { exact: true })
    .click()
  await page
    .getByPlaceholder(jaJP['create-folder-dialog:placeholder'])
    .fill(name)
  await page
    .getByRole('button', { name: jaJP['create-folder-dialog:create'] })
    .click()
  await expect(
    page.getByText(jaJP['create-folder-dialog:create-title']),
  ).toBeHidden()
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

// A phone, where the sidebar opens as a drawer. Which of the two shapes it
// takes is what `createFolder` has to click through, and this is the one the
// app is mostly used in.
const PHONE = { width: 390, height: 844 }

test.describe('syncing with Google Drive without being asked', () => {
  test.use({ viewport: PHONE })

  test.beforeEach(async ({ page }) => {
    await stubGoogleIdentityServices(page, { token: 'test-access-token' })
  })

  test('takes on what another device wrote, on being opened', async ({
    page,
  }) => {
    await stubGoogleDrive(page, driveHolding(JSON.stringify(REMOTE_SNAPSHOT)))
    await page.goto(LIST_VIEW)
    await seedFolders(page, [LOCAL_ONLY_FOLDER])

    // Connecting alone does not sync -- and the reload is the point: it throws
    // away the token in memory, so what happens next has to stand on the grant
    // Google already gave rather than on the press that just happened.
    await connect(page)
    await page.goto(LIST_VIEW)

    await expect
      .poll(() => folderNames(page))
      .toEqual([REMOTE_ONLY_FOLDER, LOCAL_ONLY_FOLDER].sort())
  })

  test('sends a change made afterwards, without anyone pressing sync', async ({
    page,
  }) => {
    const drive = await stubGoogleDrive(
      page,
      driveHolding(JSON.stringify(REMOTE_SNAPSHOT)),
    )
    await page.goto(LIST_VIEW)
    await seedFolders(page, [LOCAL_ONLY_FOLDER])
    await connect(page)

    await page.goto(LIST_VIEW)
    // Let the sync that opening the app starts finish first, so what is
    // asserted below is the push the new folder caused and not that one.
    await expect
      .poll(() => folderNames(page))
      .toEqual([REMOTE_ONLY_FOLDER, LOCAL_ONLY_FOLDER].sort())

    // Through the interface, not straight into IndexedDB: what schedules the
    // upload is Dexie telling the app a row changed, and a raw IndexedDB write
    // goes round the back of that.
    await createFolder(page, MADE_AFTER_CONNECTING)

    // The debounce is ten seconds of quiet, and nothing here is allowed to
    // shorten it: the wait is the behaviour being tested.
    await expect
      .poll(
        () => {
          const uploaded = drive.named(SYNC_FILE)?.content
          if (uploaded === undefined) {
            return []
          }
          return (JSON.parse(uploaded).folders as { name: string }[])
            .map((folder) => folder.name)
            .sort()
        },
        { timeout: 30_000 },
      )
      .toEqual(
        [REMOTE_ONLY_FOLDER, LOCAL_ONLY_FOLDER, MADE_AFTER_CONNECTING].sort(),
      )
  })
})

test.describe('never having connected to Google Drive', () => {
  // The service worker forwards same-origin GETs on the page's behalf, so a
  // test that counts requests has to be sure of who made them.
  test.use({ viewport: PHONE, serviceWorkers: 'block' })

  test('leaves Drive alone entirely', async ({ page }) => {
    await stubGoogleIdentityServices(page, { token: 'test-access-token' })
    const drive = await stubGoogleDrive(page)

    let calls = 0
    await page.route('https://www.googleapis.com/**', async (route) => {
      calls += 1
      await route.fallback()
    })

    await page.goto(LIST_VIEW)
    await seedFolders(page, [LOCAL_ONLY_FOLDER])
    await createFolder(page, MADE_AFTER_CONNECTING)

    // Long enough that a debounced upload would have gone out by now.
    await page.waitForTimeout(13_000)

    expect(calls).toBe(0)
    expect(drive.files).toHaveLength(0)
  })
})
