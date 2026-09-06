import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { stubGoogleDrive } from './stub-google-drive'
import { stubGoogleIdentityServices } from './stub-google-identity'

const BACKUP_ONLY_FOLDER = 'バックアップにだけあるフォルダ'

/** A backup in the shape releases before 2.2.0 wrote: no timestamps at all. */
const BACKUP = {
  metadata: {
    date: '2025-03-01T00:00:00.000Z',
    number_of_folders: 1,
    number_of_worlds: 1,
    app_version: '2.0.0',
  },
  worlds: [
    {
      worldId: 'wrld_from_backup',
      name: 'World From Backup',
      thumbnailUrl: 'https://example.invalid/thumb.png',
      authorName: 'someone',
      favorites: 1,
      lastUpdated: '2025-02-01',
      visits: 2,
      dateAdded: '2025-02-01T00:00:00.000Z',
      platform: ['standalonewindows'],
      folders: [BACKUP_ONLY_FOLDER],
      tags: [],
      capacity: 16,
    },
  ],
  folders: [{ name: BACKUP_ONLY_FOLDER, world_count: 1 }],
  hiddenWorlds: [],
  memos: {},
  customTags: {},
}

/**
 * Walks from the first screen to the one that asks where the data comes from.
 * The two screens before it are a language choice and a welcome.
 */
async function openTheRestoreStep(page: Page) {
  await page.goto('/setup')
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page.getByRole('button', { name: jaJP['setup-layout:start'] }).click()
  await page.getByRole('button', { name: jaJP['general:next'] }).click()
  await expect(
    page.getByText(jaJP['setup-page:restore-source-description']),
  ).toBeVisible()
}

function choice(page: Page, titleKey: keyof typeof jaJP) {
  return page.getByRole('button', { name: jaJP[titleKey] })
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
    return rows.filter((row) => row.deletedAt === null).map((row) => row.name)
  })
}

test.describe('where the setup gets its data from', () => {
  test('offers all four ways rather than one plus a way out', async ({
    page,
  }) => {
    await openTheRestoreStep(page)

    await expect(
      choice(page, 'setup-page:restore-source-v2-title'),
    ).toBeVisible()
    await expect(
      choice(page, 'setup-page:restore-source-drive-title'),
    ).toBeVisible()
    await expect(
      choice(page, 'setup-page:restore-source-backup-title'),
    ).toBeVisible()
    await expect(
      choice(page, 'setup-page:restore-source-fresh-title'),
    ).toBeVisible()
  })

  // The whole of #72: worlds.json is explained to the person who said they
  // came from the desktop app, and to nobody else.
  test('mentions the v2 files only once that is the way chosen', async ({
    page,
  }) => {
    await openTheRestoreStep(page)
    await expect(page.getByText(jaJP['general:worlds-data'])).toBeHidden()

    await choice(page, 'setup-page:restore-source-v2-title').click()

    await expect(page.getByText(jaJP['general:worlds-data'])).toBeVisible()
    await expect(page.getByText(jaJP['general:folders-data'])).toBeVisible()
  })

  test('lets a choice be taken back', async ({ page }) => {
    await openTheRestoreStep(page)
    await choice(page, 'setup-page:restore-source-v2-title').click()

    await page
      .getByRole('button', { name: jaJP['setup-page:restore-source-change'] })
      .click()

    await expect(
      choice(page, 'setup-page:restore-source-drive-title'),
    ).toBeVisible()
  })

  test('starting fresh goes straight on, with no step to dismiss', async ({
    page,
  }) => {
    await openTheRestoreStep(page)
    await choice(page, 'setup-page:restore-source-fresh-title').click()

    await expect(
      page.getByText(jaJP['setup-page:ui-customization-title']),
    ).toBeVisible()
  })

  test('offers the Google Drive connection right here', async ({ page }) => {
    await stubGoogleIdentityServices(page, { token: 'test-access-token' })
    await stubGoogleDrive(page)

    await openTheRestoreStep(page)
    await choice(page, 'setup-page:restore-source-drive-title').click()

    await page
      .getByRole('button', { name: jaJP['settings-page:google-drive-connect'] })
      .click()
    await expect(
      page.getByRole('button', {
        name: jaJP['settings-page:google-drive-sync-now'],
      }),
    ).toBeVisible()
  })

  // Appearance settings travel with a restore -- and which ones travel is the
  // user's to change, so the setup stops asking rather than asking and then
  // writing over what was just brought in.
  test('ends the setup rather than asking about appearance again', async ({
    page,
  }) => {
    await stubGoogleIdentityServices(page, { token: 'test-access-token' })
    await stubGoogleDrive(page)

    await openTheRestoreStep(page)
    await choice(page, 'setup-page:restore-source-drive-title').click()

    await expect(
      page.getByText(jaJP['setup-page:restore-skips-appearance']),
    ).toBeVisible()

    await page
      .getByRole('button', { name: jaJP['setup-layout:finish'] })
      .click()

    await expect(page).toHaveURL(/\/login$/)
    // The setup has to count as done, or the app sends them straight back to
    // it on the next load.
    expect(
      await page.evaluate(() => localStorage.getItem('setupComplete')),
    ).toBe('true')
  })

  test('starting fresh still walks through the appearance screens', async ({
    page,
  }) => {
    await openTheRestoreStep(page)
    await choice(page, 'setup-page:restore-source-fresh-title').click()

    await expect(
      page.getByText(jaJP['setup-page:ui-customization-title']),
    ).toBeVisible()
    await expect(
      page.getByText(jaJP['setup-page:restore-skips-appearance']),
    ).toBeHidden()
  })

  test('brings a backup file in, without a way to destroy anything', async ({
    page,
  }) => {
    await openTheRestoreStep(page)
    await choice(page, 'setup-page:restore-source-backup-title').click()

    const chooser = page.waitForEvent('filechooser')
    await page
      .getByRole('button', { name: jaJP['general:select-button'] })
      .click()
    await (
      await chooser
    ).setFiles({
      name: 'vrcww-backup-2025-03-01.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(BACKUP)),
    })

    // What is in the file, before committing to it.
    await expect(page.getByText('1', { exact: true }).first()).toBeVisible()

    await page
      .getByRole('button', { name: jaJP['setup-page:restore-backup-button'] })
      .click()

    await expect(
      page.getByRole('button', {
        name: jaJP['setup-page:restore-backup-done'],
      }),
    ).toBeVisible()
    expect(await folderNames(page)).toContain(BACKUP_ONLY_FOLDER)

    // Restoring here is always a merge; the destructive mode stays in
    // settings, where asking for it means it.
    await expect(
      page.getByText(jaJP['settings-page:restore-mode-replace-description']),
    ).toBeHidden()
  })
})
