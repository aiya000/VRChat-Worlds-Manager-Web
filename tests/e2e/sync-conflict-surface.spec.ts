import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { stubGoogleDrive, type FakeDriveFile } from './stub-google-drive'
import { stubGoogleIdentityServices } from './stub-google-identity'

const SETTINGS = '/listview/settings'
const LIST_VIEW = '/listview/folders/special/all'

const SYNC_FOLDER = 'VRChat Worlds Manager'
const SYNC_FILE = 'vrcww-sync.json'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

const WORLD_ID = 'wrld_shared_between_devices'
const WORLD_NAME = 'ふたつの端末で開いたワールド'

const MEMO_HERE = 'この端末で書いたメモ'
const MEMO_ELSEWHERE = 'もう片方の端末で書いたメモ'

/**
 * What the other device left on Drive. No timestamps anywhere, which is what
 * a file written before sync existed looks like -- and the case where the
 * merge cannot pick a winner on age and has to keep both texts.
 */
const REMOTE_SNAPSHOT = {
  metadata: {
    date: '2025-03-01T00:00:00.000Z',
    number_of_folders: 0,
    number_of_worlds: 1,
    app_version: '2.0.0',
  },
  worlds: [
    {
      worldId: WORLD_ID,
      name: WORLD_NAME,
      thumbnailUrl: 'https://example.invalid/thumb.png',
      authorName: 'someone',
      favorites: 1,
      lastUpdated: '2025-02-01',
      visits: 2,
      dateAdded: '2025-02-01T00:00:00.000Z',
      platform: ['standalonewindows'],
      folders: [],
      tags: [],
      capacity: 16,
    },
  ],
  folders: [],
  hiddenWorlds: [],
  memos: { [WORLD_ID]: MEMO_ELSEWHERE },
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

/**
 * Puts a world and its memo straight into the database, with the "time
 * unknown" stamp a row migrated from before sync carries. Driving the memo UI
 * instead would stamp it with the current time, and the merge would then
 * simply pick it -- which is the case with no conflict in it.
 */
async function seedWorldWithMemo(page: Page, memo: string) {
  await expect(page.locator('[data-sidebar="trigger"]')).toBeVisible()

  await page.evaluate(
    async ({ worldId, worldName, text }) => {
      const openWithStores = async (): Promise<IDBDatabase> => {
        for (let attempt = 0; attempt < 100; attempt++) {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('VRChatWorldsManager')
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })
          if (
            db.objectStoreNames.contains('worlds') &&
            db.objectStoreNames.contains('memos')
          ) {
            return db
          }
          db.close()
          await new Promise((resolve) => setTimeout(resolve, 100))
        }
        throw new Error('the world and memo stores never appeared')
      }

      const db = await openWithStores()
      // `0` is the "time unknown" stamp; see `SEED_TIMESTAMP`.
      const seed = { updatedAt: 0, deletedAt: null, origin: '' }

      await new Promise<void>((resolve, reject) => {
        const transaction = db.transaction(['worlds', 'memos'], 'readwrite')
        transaction.objectStore('worlds').put({
          ...seed,
          worldId,
          name: worldName,
          thumbnailUrl: '',
          authorName: 'someone',
          favorites: 0,
          lastUpdated: '2025-01-01',
          visits: 0,
          dateAdded: '2025-01-01T00:00:00.000Z',
          platform: [],
          folderRefs: [],
          tags: [],
          capacity: 0,
        })
        transaction.objectStore('memos').put({
          ...seed,
          worldId,
          memo: text,
          conflictBackup: null,
        })
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
      })
      db.close()
    },
    { worldId: WORLD_ID, worldName: WORLD_NAME, text: memo },
  )
}

async function openSyncTab(page: Page) {
  await page.goto(SETTINGS)
  // The dev server's overlay sits above everything and swallows clicks.
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page
    .getByRole('tab', { name: jaJP['settings-page:section-sync'] })
    .click()
}

async function connectAndSync(page: Page) {
  await openSyncTab(page)
  await page
    .getByRole('button', { name: jaJP['settings-page:google-drive-connect'] })
    .click()
  await page
    .getByRole('button', { name: jaJP['settings-page:google-drive-sync-now'] })
    .click()
  await expect(
    page.getByText(jaJP['settings-page:memo-conflicts-title']),
  ).toBeVisible()
}

async function memoOf(page: Page, worldId: string): Promise<string> {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('VRChatWorldsManager')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const row = await new Promise<{ memo: string }>((resolve, reject) => {
      const request = db
        .transaction('memos', 'readonly')
        .objectStore('memos')
        .get(id)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    db.close()
    return row.memo
  }, worldId)
}

test.describe('memos that two devices wrote differently', () => {
  test.beforeEach(async ({ page }) => {
    await stubGoogleIdentityServices(page, { token: 'test-access-token' })
    await stubGoogleDrive(page, driveHolding(JSON.stringify(REMOTE_SNAPSHOT)))
    await page.goto(LIST_VIEW)
    await seedWorldWithMemo(page, MEMO_HERE)
  })

  test('shows both texts, rather than only the one that won', async ({
    page,
  }) => {
    await connectAndSync(page)

    await expect(page.getByText(WORLD_NAME)).toBeVisible()
    await expect(page.getByText(MEMO_HERE)).toBeVisible()
    // The whole point: the text that lost is on screen, not merely on the row.
    await expect(page.getByText(MEMO_ELSEWHERE)).toBeVisible()
  })

  test('puts the other device’s text back when asked', async ({ page }) => {
    await connectAndSync(page)

    await page
      .getByRole('button', {
        name: jaJP['settings-page:memo-conflicts-restore'],
      })
      .click()

    await expect.poll(() => memoOf(page, WORLD_ID)).toBe(MEMO_ELSEWHERE)
    // The two swapped rather than one being destroyed, so the entry stays and
    // pressing again returns to where it started.
    await expect(
      page.getByText(jaJP['settings-page:memo-conflicts-title']),
    ).toBeVisible()
  })

  test('stops mentioning it once the memo shown is the one to keep', async ({
    page,
  }) => {
    await connectAndSync(page)

    await page
      .getByRole('button', {
        name: jaJP['settings-page:memo-conflicts-discard'],
      })
      .click()

    await expect(
      page.getByText(jaJP['settings-page:memo-conflicts-title']),
    ).toBeHidden()
    expect(await memoOf(page, WORLD_ID)).toBe(MEMO_HERE)
  })

  test('says how long ago it synced, not what the clock said', async ({
    page,
  }) => {
    await connectAndSync(page)

    await expect(
      page.getByText(
        jaJP['settings-page:google-drive-last-synced'].replace(
          '{0}',
          jaJP['settings-page:relative-time-now'],
        ),
      ),
    ).toBeVisible()
  })
})
