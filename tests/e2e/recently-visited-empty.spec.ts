import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const RECENTLY_VISITED = '/listview/recently-visited'

const A_WORLD = {
  id: 'wrld_e2e_recent',
  name: 'A World Visited Recently',
  authorName: 'someone',
  imageUrl: 'https://example.invalid/thumbnail.png',
  unityPackages: [{ platform: 'standalonewindows' }],
}

// The worker would otherwise answer the same-origin request itself, and the
// route below would never see it.
test.use({ serviceWorkers: 'block' })

/** Answers the recently-visited request, and counts how often it was asked. */
async function answerRecentWith(page: Page, body: unknown) {
  let requests = 0
  await page.route('**/api/1/worlds/recent**', async (route) => {
    requests += 1
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    })
  })
  return () => requests
}

async function openRecentlyVisitedPage(page: Page) {
  await page.goto(RECENTLY_VISITED)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

/**
 * An account with nothing recent used to leave this page fetching in a loop:
 * an empty answer was indistinguishable from "not asked yet", so the effect
 * that fetches on first load fired again as soon as it finished.
 */
test.describe('the recently visited page fetching what was visited recently', () => {
  test('asks once and shows the empty message when there is nothing', async ({
    page,
  }) => {
    const requestCount = await answerRecentWith(page, [])
    await openRecentlyVisitedPage(page)

    await expect(
      page.getByText(jaJP['find-page:no-recently-visited-worlds']),
    ).toBeVisible()
    await expect(page.getByTestId('world-grid-skeleton')).toBeHidden()

    // Long enough for another round of the loop to have shown itself: the
    // toast this page raises lasts a second.
    await page.waitForTimeout(4000)

    expect(requestCount()).toBe(1)
    await expect(
      page.getByText(jaJP['find-page:no-recently-visited-worlds']),
    ).toBeVisible()
    await expect(page.getByTestId('world-grid-skeleton')).toBeHidden()
  })

  test('asks once and shows the worlds when there are some', async ({
    page,
  }) => {
    const requestCount = await answerRecentWith(page, [A_WORLD])
    await openRecentlyVisitedPage(page)

    await expect(page.getByText(A_WORLD.name)).toBeVisible()
    await expect(
      page.getByText(jaJP['find-page:no-recently-visited-worlds']),
    ).toBeHidden()

    await page.waitForTimeout(4000)

    expect(requestCount()).toBe(1)
    await expect(page.getByText(A_WORLD.name)).toBeVisible()
  })
})
