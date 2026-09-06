import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { stubGoogleIdentityServices } from './stub-google-identity'

const SETTINGS = '/listview/settings'

async function openSyncTab(page: Page) {
  await page.goto(SETTINGS)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page
    .getByRole('tab', { name: jaJP['settings-page:section-sync'] })
    .click()
  await expect(
    page.getByText(jaJP['settings-page:google-drive-title'], {
      exact: true,
    }),
  ).toBeVisible()
}

test.describe('connecting to Google Drive', () => {
  test('starts out disconnected', async ({ page }) => {
    await stubGoogleIdentityServices(page, { token: 'unused' })
    await openSyncTab(page)

    await expect(
      page.getByRole('button', {
        name: jaJP['settings-page:google-drive-connect'],
      }),
    ).toBeVisible()
  })

  test('shows connected once the token comes back', async ({ page }) => {
    await stubGoogleIdentityServices(page, { token: 'a-fake-token' })
    await openSyncTab(page)

    await page
      .getByRole('button', { name: jaJP['settings-page:google-drive-connect'] })
      .click()

    await expect(
      page.getByText(jaJP['settings-page:google-drive-connected'], {
        exact: true,
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: jaJP['settings-page:google-drive-disconnect'],
      }),
    ).toBeVisible()
  })

  test('stays connected across a reload', async ({ page }) => {
    await stubGoogleIdentityServices(page, { token: 'a-fake-token' })
    await openSyncTab(page)
    await page
      .getByRole('button', { name: jaJP['settings-page:google-drive-connect'] })
      .click()
    await expect(
      page.getByText(jaJP['settings-page:google-drive-connected'], {
        exact: true,
      }),
    ).toBeVisible()

    await page.reload()
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })
    await page
      .getByRole('tab', { name: jaJP['settings-page:section-sync'] })
      .click()

    // The connection flag is what survives, not the token itself -- a fresh
    // token is asked for again the next time one is actually needed.
    await expect(
      page.getByText(jaJP['settings-page:google-drive-connected'], {
        exact: true,
      }),
    ).toBeVisible()
  })

  test('goes back to disconnected when asked', async ({ page }) => {
    await stubGoogleIdentityServices(page, { token: 'a-fake-token' })
    await openSyncTab(page)
    await page
      .getByRole('button', { name: jaJP['settings-page:google-drive-connect'] })
      .click()
    await expect(
      page.getByRole('button', {
        name: jaJP['settings-page:google-drive-disconnect'],
      }),
    ).toBeVisible()

    await page
      .getByRole('button', {
        name: jaJP['settings-page:google-drive-disconnect'],
      })
      .click()

    await expect(
      page.getByRole('button', {
        name: jaJP['settings-page:google-drive-connect'],
      }),
    ).toBeVisible()
  })

  test('surfaces the error rather than claiming a connection that failed', async ({
    page,
  }) => {
    await stubGoogleIdentityServices(page, { error: 'access_denied' })
    await openSyncTab(page)

    await page
      .getByRole('button', { name: jaJP['settings-page:google-drive-connect'] })
      .click()

    await expect(page.getByText('access_denied')).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: jaJP['settings-page:google-drive-connect'],
      }),
    ).toBeVisible()
  })
})
