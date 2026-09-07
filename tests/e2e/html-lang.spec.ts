import { expect, test, type Page } from '@playwright/test'

const SETTINGS = '/listview/settings'

async function openSettings(page: Page) {
  await page.goto(SETTINGS)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

async function chooseLanguage(page: Page, label: string) {
  await page.getByTestId('language-select').click()
  await page.getByRole('option', { name: label }).click()
}

/**
 * `layout.tsx` ships `lang="en"` in the static HTML, and the locale is only
 * known after the local database is read. Nothing used to close that gap, so
 * a screen reader was told English however the app was set.
 */
test.describe('the lang the document reports', () => {
  test('follows the language the settings are set to', async ({ page }) => {
    await openSettings(page)

    await chooseLanguage(page, '日本語')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')

    await chooseLanguage(page, 'English')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')

    await chooseLanguage(page, '日本語')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  })

  test('is already right on the next page load, without being touched', async ({
    page,
  }) => {
    await openSettings(page)
    await chooseLanguage(page, '日本語')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')

    await page.goto('/listview/folders/special/all')
    await expect(page.locator('html')).toHaveAttribute('lang', 'ja')
  })
})
