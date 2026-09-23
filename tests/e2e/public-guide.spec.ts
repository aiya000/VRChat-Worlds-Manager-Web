import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const GUIDE = '/guide'

async function hideDevOverlay(page: Page) {
  // The dev overlay sits over the whole page and swallows the click.
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

// The PDF handed out on BOOTH carries only an outline and a link to this page
// (#162), so it has to be readable by someone who has never opened the app:
// no setup, no sign-in, and every device's steps at once.
test.describe('the public guide', () => {
  test('is readable before the setup, and stays put', async ({ page }) => {
    await page.goto(GUIDE)

    await expect(
      page.getByRole('heading', { name: jaJP['public-guide:title'] }),
    ).toBeVisible()
    await expect(page.getByTestId('public-guide-unofficial')).toBeVisible()
    await expect(page.getByRole('link', { name: 'vrcww.com' })).toBeVisible()
    for (const key of [
      'public-guide:install-android',
      'public-guide:install-ios',
      'public-guide:install-desktop',
    ] as const) {
      await expect(page.getByText(jaJP[key])).toBeVisible()
    }
    await expect(page.getByTestId('vr-projection-notice')).toBeVisible()

    // Nothing here may send a first-time reader on into the app by itself.
    await page.waitForTimeout(1000)
    await expect(page).toHaveURL(new RegExp(`${GUIDE}$`))
  })

  test('is linked from the landing page', async ({ page }) => {
    await page.goto('/')
    await hideDevOverlay(page)

    await page
      .getByRole('link', { name: jaJP['public-guide:link-label'], exact: true })
      .click()

    await expect(page).toHaveURL(new RegExp(`${GUIDE}$`))
  })

  test('is linked from About, and goes back there', async ({ page }) => {
    await page.goto('/listview/about')
    await hideDevOverlay(page)

    await page
      .getByRole('link', { name: jaJP['public-guide:link-label'], exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: jaJP['public-guide:title'] }),
    ).toBeVisible()

    await page.getByRole('link', { name: jaJP['public-guide:back'] }).click()
    await expect(page).toHaveURL(/\/listview\/about$/)
  })

  test('is linked from the in-app guide', async ({ page }) => {
    await page.goto('/listview/guide')
    await hideDevOverlay(page)

    await page
      .getByRole('link', { name: jaJP['guide-page:full-guide-link'] })
      .click()

    await expect(
      page.getByRole('heading', { name: jaJP['public-guide:title'] }),
    ).toBeVisible()
  })
})
