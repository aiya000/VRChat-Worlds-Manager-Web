import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedFolders } from './seed-folders'

const LIST_VIEW = '/listview/folders/special/all'
const FIND = '/listview/folders/special/find'

const FOLDER = 'あとで行く'
const WORLD_ID = 'wrld_from_the_search'
const WORLD_NAME = 'FoundInTheSearch'

test.use({ serviceWorkers: 'block' })

function vrchatWorld() {
  return {
    id: WORLD_ID,
    name: WORLD_NAME,
    authorId: 'usr_e2e',
    authorName: 'someone',
    imageUrl: 'https://example.invalid/image.png',
    thumbnailImageUrl: 'https://example.invalid/thumb.png',
    description: 'A world nobody has saved yet',
    favorites: 3,
    visits: 40,
    capacity: 16,
    recommendedCapacity: 8,
    updated_at: '2026-01-01T00:00:00.000Z',
    publicationDate: '2025-01-01T00:00:00.000Z',
    releaseStatus: 'public',
    tags: [],
    unityPackages: [{ platform: 'standalonewindows' }],
  }
}

/**
 * The search answers with a world, and so does the detail lookup that follows
 * a card being opened -- the world is not on this device, which is the whole
 * point of these cases.
 */
async function stubVRChat(page: Page) {
  await page.route('**/api/1/worlds/recent*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([vrchatWorld()]),
    })
  })
  await page.route(`**/api/1/worlds/${WORLD_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(vrchatWorld()),
    })
  })
}

async function openTheSearchPage(page: Page) {
  await page.goto(LIST_VIEW)
  await seedFolders(page, [FOLDER])
  await page.goto(FIND)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await expect(page.getByText(WORLD_NAME).first()).toBeVisible()
}

async function foldersOfTheWorld(page: Page): Promise<string[]> {
  return page.evaluate(async (worldId: string) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('VRChatWorldsManager')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const read = <T>(store: string, key?: string) =>
      new Promise<T>((resolve, reject) => {
        const objectStore = db.transaction(store).objectStore(store)
        const request =
          key === undefined ? objectStore.getAll() : objectStore.get(key)
        request.onsuccess = () => resolve(request.result as T)
        request.onerror = () => reject(request.error)
      })

    const world = await read<
      | { folderRefs?: { folderId: string; removedAt?: number | null }[] }
      | undefined
    >('worlds', worldId)
    const folders = await read<{ id: string; name: string }[]>('foldersById')
    db.close()
    if (world === undefined) {
      return []
    }
    const nameById = new Map(folders.map((folder) => [folder.id, folder.name]))
    return (world.folderRefs ?? [])
      .filter((ref) => ref.removedAt === null || ref.removedAt === undefined)
      .map((ref) => nameById.get(ref.folderId) ?? ref.folderId)
  }, WORLD_ID)
}

/**
 * A world found through the search is not on this device yet, and filing it
 * into a folder is the act that puts it there. Every route into that used to
 * answer as though it had worked and leave nothing behind: `addWorldToFolder`
 * returned quietly when it found no row to file.
 */
test.describe('filing a world found through the search', () => {
  test.beforeEach(async ({ page }) => {
    await stubVRChat(page)
  })

  test('offers the folders in the world detail, and files it into one', async ({
    page,
  }) => {
    await openTheSearchPage(page)
    await page.getByText(WORLD_NAME).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(jaJP['general:folders'])).toBeVisible()

    await dialog.getByRole('checkbox').first().click()

    await expect
      .poll(() => foldersOfTheWorld(page), { timeout: 10000 })
      .toEqual([FOLDER])
  })

  test('files it from the long press on the card', async ({ page }) => {
    await openTheSearchPage(page)

    await page.getByText(WORLD_NAME).first().click({ button: 'right' })
    await page
      .getByRole('menuitem', { name: jaJP['world-grid:add-title'] })
      .click()

    await page.getByRole('dialog').getByRole('button', { name: FOLDER }).click()
    await page
      .getByRole('dialog')
      .getByRole('button', { name: jaJP['general:confirm'] })
      .click()

    await expect
      .poll(() => foldersOfTheWorld(page), { timeout: 10000 })
      .toEqual([FOLDER])
  })
})
