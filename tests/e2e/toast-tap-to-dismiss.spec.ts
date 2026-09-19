import { expect, test, type Locator, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { stubGoogleAuth } from './stub-google-auth'

const SETTINGS_SYNC = '/listview/settings?tab=sync'

test.use({ serviceWorkers: 'block' })

// Sonner draws each toast as a list item inside its notifications region.
const toasts = (page: Page) =>
  page.getByRole('region', { name: /Notifications/ }).getByRole('listitem')

/**
 * Raises a toast that lives long enough to be acted on: the one that says
 * Google refused, which sonner keeps for its default four seconds.
 */
async function raiseAToast(page: Page): Promise<Locator> {
  await stubGoogleAuth(page, { denied: 'access_denied' })
  await page.goto(SETTINGS_SYNC)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page
    .getByRole('button', {
      name: jaJP['settings-page:google-drive-connect'],
      exact: true,
    })
    .click()
  const toast = toasts(page).filter({
    hasText: jaJP['settings-page:google-drive-denied'],
  })
  await expect(toast).toBeVisible()
  return toast
}

/**
 * A swipe was the only way to put a toast away by hand, and it is the wrong
 * gesture on both of the screens this app is for: on a phone it is the
 * sidebar's, and in VR a laser cannot drag. A tap is what both can do (#211).
 */
test.describe('putting a toast away', () => {
  test('a tap on it is enough', async ({ page }) => {
    const toast = await raiseAToast(page)

    await toast.click()

    // Well inside the four seconds it would have lived on its own, so this is
    // the tap's doing and not the timer's.
    await expect(toast).toBeHidden({ timeout: 1500 })
  })

  test('a sideways drag is not a way any more', async ({ page }) => {
    const toast = await raiseAToast(page)
    const box = (await toast.boundingBox())!

    // The drag a sidebar swipe would make, delivered as sonner sees it.
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2, {
      steps: 6,
    })
    await page.mouse.move(box.x + box.width / 2 + 160, box.y + box.height / 2, {
      steps: 6,
    })
    await page.mouse.up()

    await page.waitForTimeout(500)
    await expect(toast).toBeVisible()
  })

  test('a drag down still is', async ({ page }) => {
    const toast = await raiseAToast(page)
    const box = (await toast.boundingBox())!

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 40, {
      steps: 6,
    })
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 + 120, {
      steps: 6,
    })
    await page.mouse.up()

    await expect(toast).toBeHidden({ timeout: 1500 })
  })
})
