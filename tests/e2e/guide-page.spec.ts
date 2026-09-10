import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const GUIDE = '/listview/guide'
const CREDITS = '/listview/about'

async function openList(page: Page) {
  await page.goto('/listview/folders/special/all')
  // The dev overlay sits over the whole page and swallows the click.
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

// How to install the app and how to use it in VR are about using it, not
// about who made it. They have a page of their own, and the About page is
// left to the credits, as the original's is.
test.describe('the guide page', () => {
  test('is reached from the sidebar, and holds both notices', async ({
    page,
  }) => {
    await openList(page)

    await page.getByText(jaJP['app-sidebar:guide'], { exact: true }).click()

    await expect(page).toHaveURL(new RegExp(`${GUIDE}$`))
    await expect(page.getByText(jaJP['guide-page:install-title'])).toBeVisible()
    await expect(page.getByTestId('pwa-install-notice')).toBeVisible()
    await expect(
      page.getByText(jaJP['guide-page:vr-usage-title']),
    ).toBeVisible()
    await expect(page.getByTestId('vr-projection-notice')).toBeVisible()
  })

  test('leaves the About page to the credits', async ({ page }) => {
    await openList(page)

    await page.getByText(jaJP['app-sidebar:credits'], { exact: true }).click()

    await expect(page).toHaveURL(new RegExp(`${CREDITS}$`))
    await expect(
      page.getByText(jaJP['about-section:original-title']),
    ).toBeVisible()
    await expect(page.getByTestId('pwa-install-notice')).toBeHidden()
    await expect(page.getByTestId('vr-projection-notice')).toBeHidden()
  })

  // On a phone the sidebar is the whole screen, so every row it gains is a
  // folder pushed out of view. The credits link shares the privacy policy's
  // row rather than taking one of its own.
  test('keeps the credits link on the privacy policy row', async ({ page }) => {
    await openList(page)

    const privacy = page.getByText(jaJP['privacy-policy:link-label'], {
      exact: true,
    })
    const credits = page.getByText(jaJP['app-sidebar:credits'], {
      exact: true,
    })
    await expect(privacy).toBeVisible()
    await expect(credits).toBeVisible()

    const [privacyBox, creditsBox] = await Promise.all([
      privacy.boundingBox(),
      credits.boundingBox(),
    ])
    expect(privacyBox).not.toBeNull()
    expect(creditsBox).not.toBeNull()
    expect(Math.abs(privacyBox!.y - creditsBox!.y)).toBeLessThan(2)
    expect(creditsBox!.x).toBeGreaterThan(privacyBox!.x)
  })
})
