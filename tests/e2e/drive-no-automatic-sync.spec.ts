import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedFolders } from './seed-folders'
import { stubGoogleDrive, type FakeDriveFile } from './stub-google-drive'
import {
  stubGoogleIdentityServices,
  tokenRequestCount,
} from './stub-google-identity'

const SETTINGS = '/listview/settings'
const LIST_VIEW = '/listview/folders/special/all'

const SYNC_FOLDER = 'VRChat Worlds Manager'
const SYNC_FILE = 'vrcww-sync.json'

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

const REMOTE_ONLY_FOLDER = 'Driveにだけあるフォルダ'
const LOCAL_ONLY_FOLDER = 'この端末で作ったフォルダ'
const MADE_AFTER_CONNECTING = 'あとから作ったフォルダ'

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

async function hideDevOverlay(page: Page) {
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

async function connect(page: Page) {
  await page.goto(SETTINGS)
  await hideDevOverlay(page)
  await page
    .getByRole('tab', { name: jaJP['settings-page:section-sync'] })
    .click()
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

const PHONE = { width: 390, height: 844 }

/**
 * The app used to sync on its own -- on startup, a while after an edit, on
 * coming back to the tab, and on a poll -- and one version of that opened
 * Google's sign-in window with nobody having pressed anything. Syncing is a
 * press now (#124), and this is the check that nothing quietly brought the
 * old behaviour back.
 */
test.describe('nothing syncs without a press', () => {
  // The service worker forwards same-origin GETs on the page's behalf, so a
  // test that counts requests has to be sure of who made them.
  test.use({ viewport: PHONE, serviceWorkers: 'block' })

  test('a connected device that changed something waits to be asked', async ({
    page,
  }) => {
    await stubGoogleIdentityServices(page, { token: 'test-access-token' })
    const drive = await stubGoogleDrive(
      page,
      driveHolding(JSON.stringify(REMOTE_SNAPSHOT)),
    )
    await page.goto(LIST_VIEW)
    await seedFolders(page, [LOCAL_ONLY_FOLDER])
    await connect(page)

    // Back on the list, with the token gone the way a reload takes it.
    await page.goto(LIST_VIEW)
    await hideDevOverlay(page)
    expect(await tokenRequestCount(page)).toBe(0)

    await createFolder(page, MADE_AFTER_CONNECTING)
    // Longer than any of the old triggers ever waited.
    await page.waitForTimeout(13_000)

    expect(await tokenRequestCount(page)).toBe(0)
    expect(
      (
        JSON.parse(drive.named(SYNC_FILE)!.content).folders as {
          name: string
        }[]
      ).map((f) => f.name),
    ).toEqual([REMOTE_ONLY_FOLDER])
    // ...and the button is where the edit is waiting to go.
    await expect(page.getByTestId('drive-sync-button')).toHaveAttribute(
      'data-unsynced',
      'true',
    )
  })

  test('a device that never connected leaves Drive alone entirely', async ({
    page,
  }) => {
    await stubGoogleIdentityServices(page, { token: 'test-access-token' })
    const drive = await stubGoogleDrive(page)

    let calls = 0
    await page.route('https://www.googleapis.com/**', async (route) => {
      calls += 1
      await route.fallback()
    })

    await page.goto(LIST_VIEW)
    await hideDevOverlay(page)
    await seedFolders(page, [LOCAL_ONLY_FOLDER])
    await createFolder(page, MADE_AFTER_CONNECTING)
    await page.waitForTimeout(13_000)

    expect(calls).toBe(0)
    expect(drive.files).toHaveLength(0)
  })
})
