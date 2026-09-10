import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const SEARCH = '/listview/search'

const PC_WORLD = 'SearchedDesktopHall'
const CROSS_WORLD = 'SearchedCrossPlaza'

test.use({ serviceWorkers: 'block' })

function vrchatWorld(name: string, platforms: string[]) {
  return {
    id: `wrld_${name}`,
    name,
    authorId: 'usr_e2e',
    authorName: 'someone',
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
    unityPackages: platforms.map((platform) => ({ platform })),
  }
}

/**
 * VRChat answers a `platform` it was not asked about with the whole page, so
 * both what goes out and what comes back have to be checked: the search sends
 * one platform at most and finishes the rest of the AND here.
 */
async function stubVRChat(page: Page, searchUrls: string[]) {
  await page.route('**/api/1/worlds?*', async (route) => {
    searchUrls.push(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        vrchatWorld(PC_WORLD, ['standalonewindows']),
        vrchatWorld(CROSS_WORLD, ['standalonewindows', 'android']),
      ]),
    })
  })
}

async function openTheSearchPage(page: Page) {
  await page.goto(SEARCH)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

async function search(page: Page) {
  await page
    .getByRole('button', { name: jaJP['find-page:search-button'] })
    .click()
}

test.describe('filtering the world search by supported platform', () => {
  test('asks VRChat about nothing while no box is ticked', async ({ page }) => {
    const searchUrls: string[] = []
    await stubVRChat(page, searchUrls)
    await openTheSearchPage(page)

    await search(page)

    await expect(page.getByText(PC_WORLD).first()).toBeVisible()
    await expect(page.getByText(CROSS_WORLD).first()).toBeVisible()
    expect(searchUrls).toHaveLength(1)
    expect(new URL(searchUrls[0]).searchParams.getAll('platform')).toEqual([])
  })

  test('sends the ticked platform and drops what VRChat sent anyway', async ({
    page,
  }) => {
    const searchUrls: string[] = []
    await stubVRChat(page, searchUrls)
    await openTheSearchPage(page)

    await page.locator('#find-platform-android').click()
    await search(page)

    await expect(page.getByText(CROSS_WORLD).first()).toBeVisible()
    // The stub answers with the PC-only world too, the way VRChat does: a
    // `platform` it was asked about is not a promise about the rest of the page.
    await expect(page.getByText(PC_WORLD).first()).toBeHidden()
    expect(new URL(searchUrls[0]).searchParams.getAll('platform')).toEqual([
      'android',
    ])
  })

  test('sends one value for two ticks, not a pair VRChat answers emptily', async ({
    page,
  }) => {
    const searchUrls: string[] = []
    await stubVRChat(page, searchUrls)
    await openTheSearchPage(page)

    await page.locator('#find-platform-standalonewindows').click()
    await page.locator('#find-platform-android').click()
    await search(page)

    // Wait for the answer to be on screen before reading what went out --
    // the click resolves before the request does.
    await expect(page.getByText(CROSS_WORLD).first()).toBeVisible()
    await expect(page.getByText(PC_WORLD).first()).toBeHidden()
    expect(new URL(searchUrls[0]).searchParams.getAll('platform')).toEqual([
      'android',
    ])
  })

  test('does not offer "unknown", which VRChat cannot be asked about', async ({
    page,
  }) => {
    const searchUrls: string[] = []
    await stubVRChat(page, searchUrls)
    await openTheSearchPage(page)

    await expect(page.locator('#find-platform-android')).toBeVisible()
    await expect(page.locator('#find-platform-unknown')).toHaveCount(0)
  })
})
