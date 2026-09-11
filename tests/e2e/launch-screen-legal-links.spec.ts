import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

/**
 * The launch screen decides where the app starts, and that decision waits on
 * the network. Someone who opens the terms or the privacy policy while it is
 * still deciding must be left where they went: the redirect is what the app
 * wanted, not what the user asked for.
 */
test.describe('leaving the launch screen for a legal document', () => {
  // The sign-in check is what the decision waits on, and the service worker
  // would make that request itself, out of `page.route()`'s reach.
  test.use({ serviceWorkers: 'block' })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('setupComplete', 'true')
    })
  })

  /**
   * Hold the sign-in check open until the returned function is called, so the
   * launch screen is still deciding for as long as the test needs it to be.
   */
  async function holdTheSignInCheck(page: Page): Promise<() => void> {
    let release = () => {}
    const held = new Promise<void>((resolve) => {
      release = resolve
    })

    await page.route('**/auth/user*', async (route) => {
      await held
      await route.fulfill({ status: 200, body: '{}' })
    })

    return release
  }

  for (const [label, linkLabel, path] of [
    ['terms of use', jaJP['terms:link-label'], '/terms'],
    ['privacy policy', jaJP['privacy-policy:link-label'], '/privacy'],
  ] as const) {
    test(`stays on the ${label} once the launch screen has decided`, async ({
      page,
    }) => {
      const releaseTheSignInCheck = await holdTheSignInCheck(page)
      await page.goto('/')
      await page.addStyleTag({
        content: 'nextjs-portal { display: none !important; }',
      })

      await page.getByRole('link', { name: linkLabel }).click()
      await expect(page).toHaveURL(new RegExp(`${path}$`))

      releaseTheSignInCheck()

      // Long enough for the redirect to have landed if it were going to.
      await page.waitForTimeout(2000)
      await expect(page).toHaveURL(new RegExp(`${path}$`))
    })
  }
})
