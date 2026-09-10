import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const PHONE = { width: 390, height: 844 }

const LIST_VIEW = '/listview/folders/special/all'

const RECENTLY_VISITED_LABEL = jaJP['find-page:recently-visited']
const SEARCH_LABEL = jaJP['general:search-worlds']

async function openTheDrawer(page: Page) {
  await page.setViewportSize(PHONE)
  await page.goto(LIST_VIEW)
  // The dev server floats an overlay over the bottom-left corner, right where
  // the drawer's own entries sit, and it swallows clicks meant for them.
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page.locator('[data-sidebar="trigger"]').click()
  await expect(page.getByRole('dialog')).toBeVisible()
}

/**
 * "Find worlds" held the visit history and the search for new worlds in two
 * tabs of one page, so the sidebar entry that said "find" opened a list of
 * places already been to, and searching cost a tap every time (#183). They
 * are two pages now, and the sidebar says so.
 */
test.describe('the two pages "find worlds" was split into', () => {
  test('are both reachable from the sidebar, by their own names', async ({
    page,
  }) => {
    await openTheDrawer(page)
    await page.getByRole('dialog').getByText(RECENTLY_VISITED_LABEL).click()
    await expect(page).toHaveURL(/\/listview\/recently-visited/)
    await expect(
      page.getByRole('heading', { name: RECENTLY_VISITED_LABEL }),
    ).toBeVisible()

    await openTheDrawer(page)
    await page.getByRole('dialog').getByText(SEARCH_LABEL).click()
    await expect(page).toHaveURL(/\/listview\/search/)
    await expect(
      page.getByRole('heading', { name: SEARCH_LABEL }),
    ).toBeVisible()
  })

  test('carry no tab bar between them', async ({ page }) => {
    await page.goto('/listview/recently-visited')
    await expect(
      page.getByRole('heading', { name: RECENTLY_VISITED_LABEL }),
    ).toBeVisible()
    await expect(page.getByRole('tab')).toHaveCount(0)

    await page.goto('/listview/search')
    await expect(
      page.getByRole('heading', { name: SEARCH_LABEL }),
    ).toBeVisible()
    await expect(page.getByRole('tab')).toHaveCount(0)
  })

  /**
   * The separator between the two groups is the line between "worlds this
   * device holds" and "worlds it may not", so "unclassified" belongs beside
   * "all worlds" rather than beside the two pages above.
   */
  test("sit below the collection's own two entries, in that order", async ({
    page,
  }) => {
    await openTheDrawer(page)

    const entries = await page
      .getByRole('dialog')
      .getByText(
        new RegExp(
          [
            jaJP['general:all-worlds'],
            jaJP['general:unclassified-worlds'],
            RECENTLY_VISITED_LABEL,
            SEARCH_LABEL,
          ]
            .map((label) => `^${label}$`)
            .join('|'),
        ),
      )
      .allTextContents()

    expect(entries).toEqual([
      jaJP['general:all-worlds'],
      jaJP['general:unclassified-worlds'],
      RECENTLY_VISITED_LABEL,
      SEARCH_LABEL,
    ])
  })

  test('open the search with its fields already there', async ({ page }) => {
    await page.goto('/listview/search')

    await expect(page.getByLabel(jaJP['find-page:search-query'])).toBeVisible()
    await expect(
      page.getByRole('button', { name: jaJP['find-page:search-button'] }),
    ).toBeVisible()
  })
})
