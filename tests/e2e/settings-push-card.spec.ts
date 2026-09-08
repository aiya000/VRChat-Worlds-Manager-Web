import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { stubGoogleDrive } from './stub-google-drive'
import { stubGoogleAuth } from './stub-google-auth'

const SETTINGS = '/listview/settings'

async function connect(page: Page) {
  await page.goto(SETTINGS)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page
    .getByRole('tab', { name: jaJP['settings-page:section-sync'] })
    .click()
  await page
    .getByRole('button', { name: jaJP['settings-page:google-drive-connect'] })
    .click()
  await expect(
    page.getByRole('button', {
      name: jaJP['settings-page:google-drive-sync-now'],
    }),
  ).toBeVisible()
}

/**
 * "Push this device's settings" overrules what other devices chose, which
 * "sync now" never does. Sharing a card with a divider between them made the
 * two look like the same weight of action (#119); the push has its own card,
 * with room above it.
 */
test('the push sits in its own card, clear of the Drive card', async ({
  page,
}) => {
  await stubGoogleAuth(page, { token: 'test-access-token' })
  await stubGoogleDrive(page)
  await connect(page)

  const drive = page.getByTestId('google-drive-section')
  const push = page.getByTestId('push-settings-block')
  await expect(push).toBeVisible()

  // Not nested: a separate card, not a section of the Drive one.
  await expect(drive.getByTestId('push-settings-block')).toHaveCount(0)

  // ...and with more room above it than the cards on this screen usually get.
  const driveBox = (await drive.boundingBox())!
  const pushBox = (await push.boundingBox())!
  expect(pushBox.y - (driveBox.y + driveBox.height)).toBeGreaterThanOrEqual(32)
})

test('the push is not offered before this device is connected', async ({
  page,
}) => {
  await stubGoogleAuth(page, { token: 'test-access-token' })
  await stubGoogleDrive(page)
  await page.goto(SETTINGS)
  await page
    .getByRole('tab', { name: jaJP['settings-page:section-sync'] })
    .click()

  await expect(
    page.getByRole('button', {
      name: jaJP['settings-page:google-drive-connect'],
    }),
  ).toBeVisible()
  await expect(page.getByTestId('push-settings-block')).toHaveCount(0)
})
