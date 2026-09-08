import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedFolders } from './seed-folders'

const LIST_VIEW = '/listview/folders/special/all'
const FOLDER_LIST = '[data-folder-list]'

// More folders than a phone screen can show at once.
const SEEDED = Array.from(
  { length: 15 },
  (_, index) => `Folder ${String(index + 1).padStart(2, '0')}`,
)

// A tall phone and a short one. The short one is where the fixed parts of the
// sidebar leave the folder list the least room.
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 390, height: 640 },
]

async function openSidebar(page: Page) {
  await page.goto(LIST_VIEW)
  // `.first()`: CI once saw two of these for a moment, mid-navigation.
  await page.locator('[data-sidebar="trigger"]').first().click()
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText(SEEDED[0], { exact: true })).toBeVisible()
  return drawer
}

for (const viewport of VIEWPORTS) {
  test.describe(`sidebar folder list at ${viewport.width}x${viewport.height}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto(LIST_VIEW)
      await seedFolders(page, SEEDED)
    })

    test('scrolls instead of running off the sidebar', async ({ page }) => {
      const drawer = await openSidebar(page)
      const list = page.locator(FOLDER_LIST)

      const { scrollHeight, clientHeight } = await list.evaluate((element) => ({
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
      }))
      // The list has to give up the room it cannot have and scroll instead of
      // taking its full content height.
      expect(clientHeight).toBeLessThan(scrollHeight)

      await list.evaluate((element) => {
        element.scrollTop = element.scrollHeight
      })
      await expect(
        drawer.getByText(SEEDED[SEEDED.length - 1], { exact: true }),
      ).toBeInViewport()
    })

    test('keeps what sits below the folder list on screen', async ({
      page,
    }) => {
      const drawer = await openSidebar(page)

      await expect(
        drawer.getByText(jaJP['app-sidebar:add-folder'], { exact: true }),
      ).toBeInViewport()
      await expect(
        drawer.getByText(jaJP['general:settings'], { exact: true }),
      ).toBeInViewport()
    })

    // A VR laser pointer sends mouse events, so dragging a row used to start a
    // reorder rather than scrolling the list -- which made the list impossible
    // to scroll and shuffled the folders by accident. Reordering lives on its
    // own page now.
    test('does not reorder folders when a row is dragged', async ({ page }) => {
      await openSidebar(page)
      const list = page.locator(FOLDER_LIST)
      const box = await list.boundingBox()
      if (box === null) {
        throw new Error('the folder list is not on screen')
      }

      const x = box.x + box.width / 2
      await page.mouse.move(x, box.y + box.height - 20)
      await page.mouse.down()
      for (let y = box.y + box.height - 20; y >= box.y + 10; y -= 10) {
        await page.mouse.move(x, y)
      }
      await page.mouse.up()

      // A reorder is saved, so reopening the sidebar is what shows whether one
      // happened -- the drag itself ends in a click that closes the drawer.
      const reopened = await openSidebar(page)
      await expect(reopened.locator(`${FOLDER_LIST} span.truncate`)).toHaveText(
        SEEDED,
      )
    })
  })
}
