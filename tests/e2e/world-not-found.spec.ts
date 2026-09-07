import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedWorld } from './seed-world'

const LIST_VIEW = '/listview/folders/special/all'
const WORLD_ID = 'wrld_e2e_gone'
const WORLD_NAME = 'A World That Was Deleted'

const NOT_FOUND_BODY = JSON.stringify({
  error: { message: `"World ${WORLD_ID} not found"`, status_code: 404 },
})
const NOT_PUBLIC_BODY = JSON.stringify({
  error: { message: '"World is not public"', status_code: 401 },
})

// The worker would otherwise answer the same-origin request itself, and the
// route below would never see it.
test.use({ serviceWorkers: 'block' })

async function answerWorldWith(page: Page, status: number, body: string) {
  await page.route(`**/api/1/worlds/${WORLD_ID}`, async (route) => {
    await route.fulfill({
      status,
      contentType: 'application/json',
      body,
    })
  })
}

async function openTheWorld(page: Page) {
  await page.goto(LIST_VIEW)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page.getByText(WORLD_NAME).first().click()
}

test.describe('a world VRChat no longer serves', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIST_VIEW)
    await seedWorld(page, { worldId: WORLD_ID, name: WORLD_NAME })
  })

  test('says it was deleted, shows what is saved, and folds the raw error away', async ({
    page,
  }) => {
    await answerWorldWith(page, 404, NOT_FOUND_BODY)
    await openTheWorld(page)

    const dialog = page.getByRole('dialog')
    await expect(
      dialog.getByText(jaJP['world-detail:world-not-found']),
    ).toBeVisible()
    await expect(
      dialog.getByText(jaJP['world-detail:unavailable-next-steps']),
    ).toBeVisible()
    // The saved copy: name and author, from the list row.
    await expect(dialog.getByText(WORLD_NAME).first()).toBeVisible()
    await expect(dialog.getByText('someone').first()).toBeVisible()

    // The API's JSON is there for a bug report, but not on screen.
    await expect(dialog.getByText('status_code')).not.toBeVisible()
    await dialog.getByText(jaJP['world-detail:technical-details']).click()
    await expect(dialog.getByText('status_code')).toBeVisible()
  })

  test('says it went private when that is what VRChat answered', async ({
    page,
  }) => {
    await answerWorldWith(page, 401, NOT_PUBLIC_BODY)
    await openTheWorld(page)

    const dialog = page.getByRole('dialog')
    await expect(
      dialog.getByText(jaJP['world-detail:world-not-public']),
    ).toBeVisible()
    await expect(
      dialog.getByText(jaJP['world-detail:world-not-found']),
    ).toHaveCount(0)
  })

  test('can be hidden from there, and leaves the list', async ({ page }) => {
    await answerWorldWith(page, 404, NOT_FOUND_BODY)
    await openTheWorld(page)

    await page
      .getByRole('dialog')
      .getByRole('button', { name: jaJP['general:hide-title'], exact: true })
      .click()

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByText(WORLD_NAME)).toHaveCount(0)
  })

  test('can be deleted from there, and leaves the list', async ({ page }) => {
    await answerWorldWith(page, 404, NOT_FOUND_BODY)
    await openTheWorld(page)

    await page
      .getByRole('dialog')
      .getByRole('button', { name: jaJP['general:delete'], exact: true })
      .click()

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByText(WORLD_NAME)).toHaveCount(0)
  })
})
