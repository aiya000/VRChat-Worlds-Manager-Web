import { expect, test, type Page } from '@playwright/test'
import { seedWorld } from './seed-world'

const LIST_VIEW = '/listview/folders/special/all'
const WORLD_ID = 'wrld_detail_visibility'
const WORLD_NAME = 'ライムOverDoseBar'
const AUTHOR = '紅葉会長'
/** What `seedWorld` writes, and so what the saved copy shows as the author. */
const SEEDED_AUTHOR = 'someone'

test.use({ serviceWorkers: 'block' })

const NOT_PUBLIC_BODY = JSON.stringify({
  error: { message: '"World is not public"', status_code: 401 },
})

async function describeTheWorld(page: Page) {
  await page.route(`**/api/1/worlds/${WORLD_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: WORLD_ID,
        name: WORLD_NAME,
        authorId: 'usr_e2e',
        authorName: AUTHOR,
        imageUrl: 'https://example.invalid/image.png',
        thumbnailImageUrl: 'https://example.invalid/thumb.png',
        description: '',
        favorites: 812,
        visits: 4242,
        capacity: 32,
        recommendedCapacity: 16,
        updated_at: '2025-05-05T00:00:00.000Z',
        publicationDate: 'none',
        releaseStatus: 'public',
        tags: [],
        unityPackages: [{ platform: 'standalonewindows' }],
      }),
    })
  })
}

async function refuseTheWorld(page: Page) {
  await page.route(`**/api/1/worlds/${WORLD_ID}`, async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: NOT_PUBLIC_BODY,
    })
  })
}

/** Turns off exactly what the reader turned off: author, visits, favourites. */
async function hideTheNumbers(page: Page) {
  await page.goto(LIST_VIEW)
  await page.evaluate(() => {
    localStorage.setItem(
      'worldCardFieldVisibility',
      JSON.stringify({
        name: true,
        authorName: false,
        visits: false,
        lastUpdated: true,
        favorites: false,
      }),
    )
    localStorage.setItem(
      'worldDetailFieldVisibility',
      JSON.stringify({
        visits: false,
        favorites: false,
        capacity: true,
        published: true,
        lastUpdated: true,
      }),
    )
  })
}

async function openTheWorld(page: Page) {
  await page.goto(LIST_VIEW)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page.getByText(WORLD_NAME).first().click()
}

/**
 * The world detail read the detail-field settings and not the card ones, and
 * it draws a world card of its own when VRChat will not describe the world --
 * so the author and the favourites came back on the one screen a reader who
 * turned them off is most likely to open.
 */
test.describe('the world detail and the fields that were hidden', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIST_VIEW)
    await seedWorld(page, { worldId: WORLD_ID, name: WORLD_NAME })
    await hideTheNumbers(page)
  })

  test('leaves them out when VRChat describes the world', async ({ page }) => {
    await describeTheWorld(page)
    await openTheWorld(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(WORLD_NAME)
    await expect(dialog).not.toContainText(AUTHOR)
    await expect(dialog).not.toContainText('812')
    await expect(dialog).not.toContainText('4242')
  })

  test('leaves them out of the saved copy shown when VRChat will not', async ({
    page,
  }) => {
    await refuseTheWorld(page)
    await openTheWorld(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(WORLD_NAME)
    await expect(dialog).not.toContainText(SEEDED_AUTHOR)
  })
})
