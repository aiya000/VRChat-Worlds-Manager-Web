import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const GUIDE = '/listview/guide'
const ABOUT = '/listview/about'

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

  test('leaves the About page to what the app is, not how to use it', async ({
    page,
  }) => {
    await openList(page)

    await page.getByText(jaJP['app-sidebar:about'], { exact: true }).click()

    await expect(page).toHaveURL(new RegExp(`${ABOUT}$`))
    await expect(
      page.getByRole('heading', { name: jaJP['about-section:title'] }),
    ).toBeVisible()
    await expect(page.getByTestId('pwa-install-notice')).toBeHidden()
    await expect(page.getByTestId('vr-projection-notice')).toBeHidden()
  })
})
