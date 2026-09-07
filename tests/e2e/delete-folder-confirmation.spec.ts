import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedFolders } from './seed-folders'

const LIST_VIEW = '/listview/folders/special/all'
const FOLDER_LIST = '[data-folder-list]'

const SEEDED = ['Chill', 'Home', 'Game']

async function openFolderMenu(page: Page, folderName: string) {
  const row = page.locator(FOLDER_LIST).getByText(folderName, { exact: true })
  await expect(row).toBeVisible()
  // A long press on a phone or in VR ends up as this same event.
  await row.click({ button: 'right' })
  await page
    .getByRole('menuitem', { name: jaJP['general:delete'], exact: true })
    .click()
  return page.getByRole('alertdialog')
}

function folderNames(page: Page) {
  return page.locator(`${FOLDER_LIST} span.truncate`)
}

test.describe('deleting a folder from the sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(LIST_VIEW)
    await seedFolders(page, SEEDED)
    await page.reload()
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })
    await expect(folderNames(page)).toHaveText(SEEDED)
  })

  test('asks before deleting, and cancelling keeps the folder', async ({
    page,
  }) => {
    const dialog = await openFolderMenu(page, 'Home')

    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByText(jaJP['delete-folder:title'], { exact: true }),
    ).toBeVisible()
    // The dialog has to say which folder it is about, since the menu that
    // opened it is gone by the time it is read.
    await expect(dialog).toContainText('Home')

    await dialog
      .getByRole('button', { name: jaJP['general:cancel'], exact: true })
      .click()

    await expect(dialog).toBeHidden()
    await expect(folderNames(page)).toHaveText(SEEDED)
    await page.reload()
    await expect(folderNames(page)).toHaveText(SEEDED)
  })

  test('deletes the folder only once it is confirmed', async ({ page }) => {
    const dialog = await openFolderMenu(page, 'Home')
    await expect(dialog).toBeVisible()

    await dialog
      .getByRole('button', { name: jaJP['general:delete'], exact: true })
      .click()

    await expect(dialog).toBeHidden()
    await expect(folderNames(page)).toHaveText(['Chill', 'Game'])
    await page.reload()
    await expect(folderNames(page)).toHaveText(['Chill', 'Game'])
  })
})
