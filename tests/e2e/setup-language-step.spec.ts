import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

async function openTheLanguageStep(page: Page) {
  await page.goto('/setup')
  // The dev server floats an overlay over the bottom-left corner and it
  // swallows clicks meant for the step's own buttons.
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await expect(page.getByRole('button', { name: '日本語' })).toBeVisible()
}

test.describe('the language the setup starts on', () => {
  test('offers Japanese as the one already chosen', async ({ page }) => {
    await openTheLanguageStep(page)

    // The two buttons carry their own selected state, because this step is
    // deliberately not localized -- the words on them are the only clue, and
    // which one is chosen has to be readable without them.
    await expect(page.getByRole('button', { name: '日本語' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  test('carries that choice forward when nobody touches it', async ({
    page,
  }) => {
    await openTheLanguageStep(page)

    await page.getByRole('button', { name: jaJP['setup-layout:start'] }).click()

    // The next step is localized, so it says which language actually took.
    await expect(
      page.getByText(jaJP['setup-page:thank-you'], { exact: true }),
    ).toBeVisible()
  })

  test('still lets English be chosen', async ({ page }) => {
    await openTheLanguageStep(page)

    await page.getByRole('button', { name: 'English' }).click()

    await expect(page.getByRole('button', { name: 'English' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await expect(page.getByRole('button', { name: '日本語' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })
})
