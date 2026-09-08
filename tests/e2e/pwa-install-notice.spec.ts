import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const ABOUT = '/listview/about'

async function openAbout(page: Page) {
  await page.goto(ABOUT)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

/**
 * Chrome fires this when it is willing to install the app. Nothing in a test
 * browser ever will, so the page is handed one of its own -- carrying the two
 * members the real event has that this app uses.
 */
async function offerToInstall(page: Page) {
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', {
      cancelable: true,
    }) as Event & {
      prompt?: () => Promise<void>
      userChoice?: Promise<{ outcome: string }>
      __prompted?: boolean
    }
    event.prompt = async () => {
      ;(window as unknown as { __installPrompted: boolean }).__installPrompted =
        true
    }
    event.userChoice = Promise.resolve({ outcome: 'accepted' })
    window.dispatchEvent(event)
  })
}

/**
 * Nothing on the page should offer to install an app that is already
 * installed, and an offer that interrupts is the kind nobody reads -- so this
 * lives on the About page and answers to what the browser says (#69).
 */
test.describe('installing this as an app', () => {
  test('says how, in words, where the browser will not do it for you', async ({
    page,
  }) => {
    await openAbout(page)

    await expect(page.getByTestId('pwa-install-notice')).toBeVisible()
    await expect(
      page.getByText(jaJP['about-section:install-steps-browser']),
    ).toBeVisible()
    await expect(page.getByTestId('pwa-install-button')).toBeHidden()
  })

  test('offers to do it when the browser says it can', async ({ page }) => {
    await openAbout(page)
    await expect(page.getByTestId('pwa-install-notice')).toBeVisible()

    const button = page.getByTestId('pwa-install-button')
    // The listener goes on in an effect, which runs after the paint that made
    // the notice visible -- so being able to see it is not proof that the
    // event would be heard. Offered again until it is.
    await expect(async () => {
      await offerToInstall(page)
      await expect(button).toBeVisible({ timeout: 500 })
    }).toPass({ timeout: 15_000 })
    // The words are replaced by the button that does the thing.
    await expect(
      page.getByText(jaJP['about-section:install-steps-browser']),
    ).toBeHidden()

    await button.click()

    expect(
      await page.evaluate(
        () =>
          (window as unknown as { __installPrompted?: boolean })
            .__installPrompted === true,
      ),
    ).toBe(true)
  })

  test('says nothing at all once the app is already installed', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      const real = window.matchMedia.bind(window)
      window.matchMedia = ((query: string) =>
        query.includes('display-mode: standalone')
          ? ({
              matches: true,
              media: query,
              addEventListener: () => {},
              removeEventListener: () => {},
            } as unknown as MediaQueryList)
          : real(query)) as typeof window.matchMedia
    })
    await openAbout(page)

    await expect(
      page.getByText(jaJP['about-section:install-title']),
    ).toBeVisible()
    await expect(page.getByTestId('pwa-install-notice')).toBeHidden()
  })
})
