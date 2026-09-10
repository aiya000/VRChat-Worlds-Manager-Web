import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const RECENTLY_VISITED = '/listview/recently-visited'

// The worker would otherwise answer the same-origin requests itself, and the
// routes below would never see them.
test.use({ serviceWorkers: 'block' })

/** Answers whatever the page asks VRChat for with the Worker's own refusal. */
async function refuseWith(page: Page, error: string) {
  await page.route('**/api/1/**', async (route) => {
    await route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error }),
    })
  })
}

async function open(page: Page) {
  await page.goto(RECENTLY_VISITED)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

/**
 * The Worker has always said which of its limits was reached, and the app
 * read none of them: whether it was a minute's wait, too many sign-in
 * attempts, or the whole day's allowance, the same generic error appeared
 * and none of them said the app itself was fine (#170).
 */
test.describe("being turned away by this app's own backend", () => {
  test("says the day's allowance is spent, and that saved worlds are safe", async ({
    page,
  }) => {
    await refuseWith(page, 'daily-quota-exceeded')
    await open(page)

    await expect(page.getByText(jaJP['backend-limit:title'])).toBeVisible()
    await expect(
      page.getByText(jaJP['backend-limit:daily-quota-spent']),
    ).toBeVisible()
  })

  test('says to wait when it is the requests-per-hour limit', async ({
    page,
  }) => {
    await refuseWith(page, 'rate-limit-exceeded')
    await open(page)

    await expect(
      page.getByText(jaJP['backend-limit:too-many-requests']),
    ).toBeVisible()
  })

  /**
   * VRChat rate limits too, and its `429` is not this app's. Claiming the
   * app had reached its own limit would send someone to wait an hour for
   * something that was never true.
   */
  test('says nothing of its own limits when VRChat is the one refusing', async ({
    page,
  }) => {
    await page.route('**/api/1/**', async (route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { message: 'Too fast', status_code: 429 },
        }),
      })
    })
    await open(page)

    await expect(page.getByText(jaJP['backend-limit:title'])).toBeHidden()
    await expect(
      page.getByText(jaJP['backend-limit:daily-quota-spent']),
    ).toBeHidden()
  })
})
