import { expect, test } from '@playwright/test'
import enUS from '../../locales/en-US.json'
import jaJP from '../../locales/ja-JP.json'

/**
 * The landing page is the first thing a visitor sees, and the only page with
 * no settings screen and no setup wizard behind it. Until this, the language
 * was `ja-JP` flat for anyone who had never chosen -- an English speaker
 * opening the app got a Japanese page and no way to say otherwise.
 */
test.describe('the language of the landing page', () => {
  test.describe('a browser that asks for Japanese', () => {
    test.use({ locale: 'ja-JP' })

    test('is answered in Japanese', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByText(jaJP['home:tagline'])).toBeVisible()
    })
  })

  test.describe('a browser that asks for English', () => {
    test.use({ locale: 'en-GB' })

    test('is answered in English, not Japanese', async ({ page }) => {
      await page.goto('/')

      await expect(page.getByText(enUS['home:tagline'])).toBeVisible()
    })

    test('can still be switched to Japanese by hand', async ({ page }) => {
      await page.goto('/')

      await page.getByRole('button', { name: 'JA', exact: true }).click()

      await expect(page.getByText(jaJP['home:tagline'])).toBeVisible()
    })
  })

  test.describe('a language chosen by hand', () => {
    test.use({ locale: 'ja-JP' })

    test('holds across a reload, rather than the browser winning it back', async ({
      page,
    }) => {
      await page.goto('/')
      await page.getByRole('button', { name: 'EN', exact: true }).click()
      await expect(page.getByText(enUS['home:tagline'])).toBeVisible()

      await page.reload()

      await expect(page.getByText(enUS['home:tagline'])).toBeVisible()
    })

    test('is the one the app itself starts in', async ({ page }) => {
      await page.goto('/')
      await page.getByRole('button', { name: 'EN', exact: true }).click()
      await expect(page.getByText(enUS['home:tagline'])).toBeVisible()

      await page.getByRole('link', { name: enUS['home:open-app'] }).click()
      await page.waitForURL(/\/setup/)

      await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    })
  })

  test('says which language is showing', async ({ page }) => {
    await page.goto('/')

    const pressed = page.locator('button[aria-pressed="true"]')

    await expect(pressed).toHaveCount(1)
    await expect(pressed).toHaveText(/^(EN|JA)$/)
  })
})
