import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const LIST_VIEW = '/listview/folders/special/all'
const WORLD_ID = 'wrld_aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const WORLD_NAME = 'PortalHeaven'

// The worker would otherwise answer the same-origin request itself, and the
// route below would never see it.
test.use({ serviceWorkers: 'block' })

async function describeTheWorld(page: Page) {
  await page.route(`**/api/1/worlds/${WORLD_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: WORLD_ID,
        name: WORLD_NAME,
        authorId: 'usr_e2e',
        authorName: 'aiya000',
        imageUrl: 'https://example.invalid/image.png',
        thumbnailImageUrl: 'https://example.invalid/thumb.png',
        description: '',
        favorites: 6,
        visits: 282,
        capacity: 32,
        recommendedCapacity: 16,
        updated_at: '2026-01-01T00:00:00.000Z',
        publicationDate: 'none',
        releaseStatus: 'private',
        tags: [],
        unityPackages: [{ platform: 'standalonewindows' }],
      }),
    })
  })
}

async function addTheWorld(page: Page) {
  await page.goto(LIST_VIEW)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page
    .getByRole('button', { name: jaJP['listview-page:add-world'], exact: true })
    .click()
  await page
    .getByPlaceholder(jaJP['add-world-dialog:placeholder'])
    .fill(WORLD_ID)
  await page
    .getByRole('button', { name: jaJP['add-world-dialog:check'] })
    .click()
  await expect(page.getByText(jaJP['add-world-dialog:preview'])).toBeVisible()
  await page
    .getByRole('button', { name: jaJP['add-world-dialog:add'], exact: true })
    .last()
    .click()
  await expect(page.getByRole('dialog')).toBeHidden()
}

/**
 * A world added by URL used to appear and then vanish.
 *
 * `getWorld` fills the world-details table, which is not the one the list
 * reads, so a world that had never been among the VRChat favourites had no row
 * to file into a folder -- and the call that files it returns quietly when it
 * finds none. What was on screen was the optimistic update alone, and the next
 * read took it away again.
 */
test.describe('a world added by its URL', () => {
  test('is still there after a reload', async ({ page }) => {
    await describeTheWorld(page)
    await addTheWorld(page)
    await expect(page.getByText(WORLD_NAME).first()).toBeVisible()

    await page.reload()
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })

    await expect(page.getByText(WORLD_NAME).first()).toBeVisible()
  })

  test('was written to the collection, not only to the screen', async ({
    page,
  }) => {
    await describeTheWorld(page)
    await addTheWorld(page)

    const stored = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('VRChatWorldsManager')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      return await new Promise<Array<{ worldId: string; name: string }>>(
        (resolve, reject) => {
          const request = db
            .transaction('worlds')
            .objectStore('worlds')
            .getAll()
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        },
      )
    })

    expect(stored.map((world) => world.worldId)).toContain(WORLD_ID)
  })
})
