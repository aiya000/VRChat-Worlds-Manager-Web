import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedFolders } from './seed-folders'
import { stubGoogleDrive, type FakeDriveFile } from './stub-google-drive'
import { stubGoogleAuth } from './stub-google-auth'

const SETTINGS = '/listview/settings'
const LIST_VIEW = '/listview/folders/special/all'

const SYNC_FOLDER = 'VRChat Worlds Manager'
const SYNC_FILE = 'vrcww-sync.json'
const BACKUP_FILE = 'vrcww-sync.bak.json'

const REMOTE_ONLY_FOLDER = 'Driveにだけあるフォルダ'
const LOCAL_ONLY_FOLDER = 'この端末で作ったフォルダ'

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
      mimeType: 'application/vnd.google-apps.folder',
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

async function connect(page: Page) {
  await page.goto(SETTINGS)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
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

test.describe('the app while a sync runs (#221)', () => {
  test.beforeEach(async ({ page }) => {
    await stubGoogleAuth(page, { token: 'test-access-token' })
    await page.goto(LIST_VIEW)
    await seedFolders(page, [LOCAL_ONLY_FOLDER])
  })

  test('is covered by a dialog that says how far it has got', async ({
    page,
  }) => {
    const drive = await stubGoogleDrive(
      page,
      driveHolding(JSON.stringify(REMOTE_SNAPSHOT)),
    )
    await connect(page)
    const release = drive.stallUploads()

    await syncNow(page)

    const dialog = page.getByTestId('sync-progress-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toHaveAttribute('role', 'alertdialog')
    await expect(page.getByTestId('sync-progress-step')).toHaveText(
      `86% — ${jaJP['settings-page:google-drive-step-uploading']}`,
    )
    // Escape does not hand the app back while the sync can still overwrite it.
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()

    release()
    await expect(
      page.getByText(jaJP['settings-page:google-drive-sync-success']),
    ).toBeVisible()
    await expect(dialog).toBeHidden()
  })

  test('can be stopped when Drive stops answering, and nothing changes', async ({
    page,
  }) => {
    const before = JSON.stringify(REMOTE_SNAPSHOT)
    const drive = await stubGoogleDrive(page, driveHolding(before))
    await connect(page)
    drive.stallUploads()

    await syncNow(page)
    await expect(page.getByTestId('sync-progress-step')).toHaveText(
      `86% — ${jaJP['settings-page:google-drive-step-uploading']}`,
    )
    await page.getByTestId('sync-abort-button').click()

    await expect(
      page.getByText(jaJP['settings-page:google-drive-sync-aborted']),
    ).toBeVisible()
    await expect(page.getByTestId('sync-progress-dialog')).toBeHidden()

    // Nothing Drive held was brought down, and nothing was sent up.
    expect(await folderNames(page)).toEqual([LOCAL_ONLY_FOLDER])
    expect(drive.named(SYNC_FILE)?.content).toBe(before)
  })

  test('syncs again normally after being stopped', async ({ page }) => {
    const drive = await stubGoogleDrive(
      page,
      driveHolding(JSON.stringify(REMOTE_SNAPSHOT)),
    )
    await connect(page)
    const release = drive.stallUploads()

    await syncNow(page)
    await page.getByTestId('sync-abort-button').click()
    await expect(
      page.getByText(jaJP['settings-page:google-drive-sync-aborted']),
    ).toBeVisible()
    release()

    await syncNow(page)
    await expect(
      page.getByText(jaJP['settings-page:google-drive-sync-success']),
    ).toBeVisible()
    expect(await folderNames(page)).toEqual(
      [REMOTE_ONLY_FOLDER, LOCAL_ONLY_FOLDER].sort(),
    )
  })
})

test.describe('the backup a sync keeps (#220)', () => {
  test.beforeEach(async ({ page }) => {
    await stubGoogleAuth(page, { token: 'test-access-token' })
    await page.goto(LIST_VIEW)
    await seedFolders(page, [LOCAL_ONLY_FOLDER])
  })

  test('is copied inside Drive, not uploaded, and never piles up', async ({
    page,
  }) => {
    const drive = await stubGoogleDrive(
      page,
      driveHolding(JSON.stringify(REMOTE_SNAPSHOT)),
    )
    const uploads: string[] = []
    page.on('request', (request) => {
      if (request.url().includes('/upload/drive/')) {
        uploads.push(request.method())
      }
    })
    await connect(page)

    // Each sync writes the file once, and the version counts the writes.
    await syncNow(page)
    await expect.poll(() => drive.named(SYNC_FILE)?.version).toBe(2)
    await expect(page.getByTestId('sync-progress-dialog')).toBeHidden()
    const afterFirst = drive.named(SYNC_FILE)!.content

    await syncNow(page)
    await expect.poll(() => drive.named(SYNC_FILE)?.version).toBe(3)
    await expect(page.getByTestId('sync-progress-dialog')).toBeHidden()

    // One upload per sync: the file itself.
    expect(uploads).toEqual(['PATCH', 'PATCH'])
    const backups = drive.files.filter((file) => file.name === BACKUP_FILE)
    expect(backups).toHaveLength(1)
    expect(backups[0].content).toBe(afterFirst)
  })
})
