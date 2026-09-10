import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const PHONE = { width: 390, height: 844 }

const SETTINGS_LABEL = jaJP['general:settings']

const sidebarTrigger = (page: Page) => page.locator('[data-sidebar="trigger"]')

/**
 * Every page the sidebar can reach, so a page added later cannot quietly
 * become one there is no way out of.
 */
const PAGES = [
  ['all worlds', '/listview/folders/special/all'],
  ['recently visited worlds', '/listview/recently-visited'],
  ['searching for worlds', '/listview/search'],
  ['hidden worlds', '/listview/folders/special/hidden'],
  ['unclassified worlds', '/listview/folders/special/unclassified'],
  ['the folder list', '/listview/folders'],
  ['reordering folders', '/listview/folders/reorder'],
  ['settings', '/listview/settings'],
  ['the guide', '/listview/guide'],
  ['the credits', '/listview/about'],
] as const

async function open(page: Page, path: string) {
  await page.setViewportSize(PHONE)
  await page.goto(path)
  // The dev server floats an overlay over the bottom-left corner, right where
  // the drawer's own entries sit, and it swallows clicks meant for them.
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

/**
 * The sidebar collapses away at every width, and on a phone it is a drawer.
 * A swipe rightwards opens that drawer, but only a phone sends one, so a page
 * that draws no trigger is still a page that cannot be left anywhere else --
 * which is what "find worlds" was, before #183 split it into the two pages
 * below.
 */
test.describe('getting back to the sidebar from', () => {
  for (const [name, path] of PAGES) {
    test(`${name}`, async ({ page }) => {
      await open(page, path)

      await expect(sidebarTrigger(page)).toBeVisible()
    })
  }

  test('recently visited worlds, all the way into the drawer', async ({
    page,
  }) => {
    await open(page, '/listview/recently-visited')

    await expect(page.getByRole('dialog')).toHaveCount(0)
    await sidebarTrigger(page).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(
      page.getByRole('dialog').getByText(SETTINGS_LABEL),
    ).toBeVisible()
  })
})
