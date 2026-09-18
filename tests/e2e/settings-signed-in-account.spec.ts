import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const SETTINGS = '/listview/settings'
const DISPLAY_NAME = 'サブアカウントのほう'

test.use({ serviceWorkers: 'block' })

/** Answers the Worker's "who am I?" the way VRChat does, or refuses it. */
async function stubCurrentUser(
  page: Page,
  answer: { displayName: string } | { status: number },
) {
  await page.route('**/api/1/auth/user', async (route) => {
    if ('status' in answer) {
      await route.fulfill({ status: answer.status, body: 'stubbed refusal' })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'usr_sub', displayName: answer.displayName }),
    })
  })
}

async function openOthersTab(page: Page) {
  await page.goto(SETTINGS)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page
    .getByRole('tab', { name: jaJP['settings-page:section-others'] })
    .click()
}

/**
 * Someone with more than one VRChat account had no way to tell which one this
 * app was signed in as (#207). The answer sits with the logout button, which
 * is the one thing it changes.
 */
test.describe('which VRChat account is signed in', () => {
  test('is named beside the logout button, by its display name', async ({
    page,
  }) => {
    await stubCurrentUser(page, { displayName: DISPLAY_NAME })
    await openOthersTab(page)

    const line = page.getByTestId('signed-in-account')
    await expect(line).toBeVisible()
    await expect(line).toContainText(jaJP['settings-page:signed-in-as'])
    await expect(line).toContainText(DISPLAY_NAME)

    // In the same card as the button it is about.
    await expect(
      line.locator(
        `xpath=ancestor::*[.//button[normalize-space()="${jaJP['settings-page:logout']}"]][1]`,
      ),
    ).toContainText(jaJP['settings-page:logout-title'])
  })

  test('says so when the account could not be read, rather than saying nothing', async ({
    page,
  }) => {
    await stubCurrentUser(page, { status: 401 })
    await openOthersTab(page)

    const line = page.getByTestId('signed-in-account')
    await expect(line).toBeVisible()
    await expect(line).toContainText(jaJP['settings-page:signed-in-unknown'])
  })
})
