import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedFolders } from './seed-folders'

const LIST_VIEW = '/listview/folders/special/all'
const FOLDERS = '/listview/folders'
const SEEDED = ['Home', 'Chill', 'Game']

async function openSidebar(page: Page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(LIST_VIEW)
  await page.locator('[data-sidebar="trigger"]').click()
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  return drawer
}

/**
 * The sidebar's "Folders" heading was a label; now it opens a page that shows
 * every folder as a card, so what is in a folder can be seen before it is
 * opened, and renaming or deleting one does not need a right-click.
 */
test.describe('the folder view', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIST_VIEW)
    await seedFolders(page, SEEDED)
  })

  test('opens from the sidebar heading', async ({ page }) => {
    const drawer = await openSidebar(page)
    await drawer.getByTestId('folders-heading').click()

    await expect(page).toHaveURL(new RegExp(`${FOLDERS}$`))
    await expect(
      page.getByRole('heading', { name: jaJP['folders-page:title'] }),
    ).toBeVisible()
    for (const name of SEEDED) {
      await expect(
        page.getByRole('button', {
          name: jaJP['folders-page:open'].replace('{0}', name),
        }),
      ).toBeVisible()
    }
  })

  test('opens a folder from its card', async ({ page }) => {
    await page.goto(FOLDERS)
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })

    await page
      .getByRole('button', {
        name: jaJP['folders-page:open'].replace('{0}', 'Chill'),
      })
      .click()

    await expect(page).toHaveURL(/userFolder\?folderName=Chill$/)
  })

  test('renames a folder from its card menu', async ({ page }) => {
    await page.goto(FOLDERS)
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })

    await page
      .getByRole('button', {
        name: jaJP['folders-page:menu'].replace('{0}', 'Game'),
      })
      .click()
    await page
      .getByRole('menuitem', { name: jaJP['app-sidebar:rename'] })
      .click()
    await page.getByLabel(jaJP['folders-page:new-name']).fill('Games')
    await page.getByRole('button', { name: jaJP['general:save'] }).click()

    await expect(
      page.getByRole('button', {
        name: jaJP['folders-page:open'].replace('{0}', 'Games'),
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: jaJP['folders-page:open'].replace('{0}', 'Game'),
      }),
    ).toHaveCount(0)
  })
})
