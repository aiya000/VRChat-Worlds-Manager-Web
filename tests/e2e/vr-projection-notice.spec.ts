import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { stubGoogleAuth } from './stub-google-auth'

const SETTINGS_SYNC = '/listview/settings?tab=sync'
const ABOUT = '/listview/about'

test.use({ serviceWorkers: 'block' })

async function open(page: Page, path: string) {
  await page.goto(path)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

/**
 * Google has refused OAuth inside embedded WebViews since 2021-09-30, and the
 * refusal is not something this app can implement its way out of. So the app
 * says how to open it somewhere a window can open, in the places someone in a
 * headset actually reaches (#91).
 */
test.describe('the recommended way to use this in VR', () => {
  test('sits beside the connect button while this device is not connected', async ({
    page,
  }) => {
    await stubGoogleAuth(page, { token: 'unused' })
    await open(page, SETTINGS_SYNC)

    const notice = page.getByTestId('vr-projection-notice')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText(jaJP['vr-setup:projection-recommended'])
  })

  test('goes away once the device is connected, having done its job', async ({
    page,
  }) => {
    await stubGoogleAuth(page, { token: 'a-fake-token' })
    await open(page, SETTINGS_SYNC)

    await page
      .getByRole('button', {
        name: jaJP['settings-page:google-drive-connect'],
        exact: true,
      })
      .click()

    await expect(
      page.getByText(jaJP['settings-page:google-drive-connected']),
    ).toBeVisible()
    await expect(page.getByTestId('vr-projection-notice')).toBeHidden()
  })

  test('is still there when Google sent the browser back empty-handed', async ({
    page,
  }) => {
    // What a browser Google will not sign in from ends with: a refusal in
    // place of a token, and a device that is no more connected than before.
    await stubGoogleAuth(page, { denied: 'access_denied' })
    await open(page, SETTINGS_SYNC)

    await page
      .getByRole('button', {
        name: jaJP['settings-page:google-drive-connect'],
        exact: true,
      })
      .click()

    await expect(
      page.getByText(jaJP['settings-page:google-drive-denied']),
    ).toBeVisible()
    await expect(
      page.getByText(jaJP['vr-setup:projection-recommended']).first(),
    ).toBeVisible()
    // And the device is not left looking connected when it is not.
    await expect(
      page.getByRole('button', {
        name: jaJP['settings-page:google-drive-connect'],
        exact: true,
      }),
    ).toBeVisible()
  })

  test('is on the About page too, where it does not depend on being stuck', async ({
    page,
  }) => {
    await open(page, ABOUT)

    await expect(
      page.getByText(jaJP['about-section:vr-usage-title']),
    ).toBeVisible()
    await expect(page.getByTestId('vr-projection-notice')).toBeVisible()
  })
})
