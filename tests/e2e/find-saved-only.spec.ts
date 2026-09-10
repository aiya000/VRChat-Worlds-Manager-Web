import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedWorld } from './seed-world'

const FIND = '/listview/folders/special/find'
const LIST_VIEW = '/listview/folders/special/all'

const SAVED_PC = 'SavedDesktopHall'
const SAVED_ANDROID = 'SavedQuestPlaza'
const FROM_VRCHAT = 'StrangerFromVRChat'

test.use({ serviceWorkers: 'block' })

/**
 * Answers every search with a world that is not in the collection, so a
 * result carrying that name proves VRChat was consulted when it should not
 * have been.
 */
async function stubVRChat(page: Page, searchUrls: string[]) {
  await page.route('**/api/1/worlds/recent*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]',
    })
  })
  await page.route('**/api/1/worlds?*', async (route) => {
    searchUrls.push(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'wrld_stranger',
          name: FROM_VRCHAT,
          authorId: 'usr_e2e',
          authorName: 'nobody',
          imageUrl: 'https://example.invalid/image.png',
          thumbnailImageUrl: 'https://example.invalid/thumb.png',
          description: '',
          favorites: 1,
          visits: 2,
          capacity: 16,
          recommendedCapacity: 8,
          updated_at: '2026-01-01T00:00:00.000Z',
          publicationDate: 'none',
          releaseStatus: 'public',
          tags: [],
          unityPackages: [{ platform: 'standalonewindows' }],
        },
      ]),
    })
  })
}

async function seedCollection(page: Page) {
  // The seeding helper waits for the sidebar trigger, which the list view
  // carries and the find page does not.
  await page.goto(LIST_VIEW)
  await seedWorld(page, {
    worldId: 'wrld_saved_pc',
    name: SAVED_PC,
    platform: ['standalonewindows'],
    tags: ['author_tag_chill'],
  })
  await seedWorld(page, {
    worldId: 'wrld_saved_android',
    name: SAVED_ANDROID,
    platform: ['standalonewindows', 'android'],
    tags: ['author_tag_game'],
  })
}

async function openSearchTab(page: Page) {
  await page.goto(FIND)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page.getByRole('tab', { name: jaJP['find-page:search-worlds'] }).click()
}

async function tickSavedOnly(page: Page) {
  await page.locator('#search-saved-only').click()
}

async function search(page: Page) {
  await page
    .getByRole('button', { name: jaJP['find-page:search-button'] })
    .click()
}

/**
 * The collection is already here, so looking through it is not a search VRChat
 * should ever hear about. Every case below is about that line staying drawn.
 */
test.describe('searching only the worlds already saved', () => {
  test.beforeEach(async ({ page }) => {
    await seedCollection(page)
  })

  test('shows the collection and never asks VRChat', async ({ page }) => {
    const searchUrls: string[] = []
    await stubVRChat(page, searchUrls)
    await openSearchTab(page)

    await tickSavedOnly(page)
    await search(page)

    await expect(page.getByText(SAVED_PC).first()).toBeVisible()
    await expect(page.getByText(SAVED_ANDROID).first()).toBeVisible()
    await expect(page.getByText(FROM_VRCHAT).first()).toBeHidden()
    expect(searchUrls).toEqual([])
  })

  test('narrows the collection by the typed words', async ({ page }) => {
    const searchUrls: string[] = []
    await stubVRChat(page, searchUrls)
    await openSearchTab(page)

    await tickSavedOnly(page)
    await page.getByLabel(jaJP['find-page:search-query']).fill('Quest')
    await search(page)

    await expect(page.getByText(SAVED_ANDROID).first()).toBeVisible()
    await expect(page.getByText(SAVED_PC).first()).toBeHidden()
    expect(searchUrls).toEqual([])
  })

  test('narrows the collection by supported platform', async ({ page }) => {
    const searchUrls: string[] = []
    await stubVRChat(page, searchUrls)
    await openSearchTab(page)

    await tickSavedOnly(page)
    await page.locator('#find-platform-android').click()
    await search(page)

    await expect(page.getByText(SAVED_ANDROID).first()).toBeVisible()
    await expect(page.getByText(SAVED_PC).first()).toBeHidden()
    expect(searchUrls).toEqual([])
  })

  test("offers the orders the collection can answer, not VRChat's", async ({
    page,
  }) => {
    const searchUrls: string[] = []
    await stubVRChat(page, searchUrls)
    await openSearchTab(page)

    await tickSavedOnly(page)
    await page.locator('#sort').click()

    await expect(
      page.getByRole('option', { name: jaJP['general:date-added'] }),
    ).toBeVisible()
    // Popularity and heat are VRChat's own measures and are not kept here.
    await expect(
      page.getByRole('option', { name: jaJP['find-page:sort-popularity'] }),
    ).toHaveCount(0)
  })

  test('goes back to asking VRChat when unticked', async ({ page }) => {
    const searchUrls: string[] = []
    await stubVRChat(page, searchUrls)
    await openSearchTab(page)

    await tickSavedOnly(page)
    await search(page)
    await expect(page.getByText(SAVED_PC).first()).toBeVisible()

    await tickSavedOnly(page)
    await search(page)

    await expect(page.getByText(FROM_VRCHAT).first()).toBeVisible()
    expect(searchUrls).toHaveLength(1)
  })
})
