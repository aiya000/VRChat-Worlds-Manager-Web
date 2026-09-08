import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedFolders } from './seed-folders'
import { stubGoogleDrive } from './stub-google-drive'
import { stubGoogleAuth } from './stub-google-auth'

const SETTINGS = '/listview/settings'
const SETTINGS_SYNC = '/listview/settings?tab=sync'
const LIST_VIEW = '/listview/folders/special/all'
const RETURN_PATH = '/google-auth'

const SYNC_FILE = 'vrcww-sync.json'
const LOCAL_ONLY_FOLDER = 'この端末で作ったフォルダ'

async function hideDevOverlay(page: Page) {
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

async function connect(page: Page) {
  await page.goto(SETTINGS)
  await hideDevOverlay(page)
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

const syncButton = (page: Page) => page.getByTestId('drive-sync-button')
const proceed = (page: Page) =>
  page.getByRole('button', { name: jaJP['sync-explanation:action-sync'] })
const successToast = (page: Page) =>
  page.getByText(jaJP['settings-page:google-drive-sync-success'])

async function isConnected(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('VRChatWorldsManager')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    const row = await new Promise<{ value: string } | undefined>(
      (resolve, reject) => {
        const request = db
          .transaction('googleAuthState', 'readonly')
          .objectStore('googleAuthState')
          .get('connected')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      },
    )
    db.close()
    return row?.value === 'true'
  })
}

/**
 * The token is fetched by leaving the page for Google and being sent back
 * (#104). A popup could not always hand its answer back to an app opened
 * from the home screen; a page that leaves and returns has nothing to hand
 * back across, but it does have to find its way back to where it was, and
 * carry on with what it was doing.
 */
test.describe('coming back from Google', () => {
  test('lands on the sync tab after connecting from the settings', async ({
    page,
  }) => {
    await stubGoogleAuth(page, { token: 'test-access-token' })
    await connect(page)

    // Not the first tab: the trip ends on the card that was pressed.
    await expect(page).toHaveURL(
      (url) => url.pathname + url.search === SETTINGS_SYNC,
    )
    await expect(
      page.getByText(jaJP['settings-page:google-drive-connected'], {
        exact: true,
      }),
    ).toBeVisible()
  })

  test('runs the sync that was pressed on the list, back on that list', async ({
    page,
  }) => {
    const google = await stubGoogleAuth(page, { token: 'test-access-token' })
    const drive = await stubGoogleDrive(page)
    await page.goto(LIST_VIEW)
    await seedFolders(page, [LOCAL_ONLY_FOLDER])
    await connect(page)

    // A fresh load has no token, so the press has to leave for one.
    await page.goto(LIST_VIEW)
    await hideDevOverlay(page)
    const tripsBefore = google.trips()
    await syncButton(page).click()
    await proceed(page).click()

    await expect(successToast(page)).toBeVisible()
    expect(google.trips()).toBe(tripsBefore + 1)
    await expect(page).toHaveURL(
      (url) => url.pathname + url.search === LIST_VIEW,
    )
    expect(drive.named(SYNC_FILE)).toBeDefined()
  })

  test('leaves the token out of the address bar and out of history', async ({
    page,
  }) => {
    await stubGoogleAuth(page, { token: 'test-access-token' })
    await connect(page)

    expect(page.url()).not.toContain('access_token')
    await page.goBack()
    expect(page.url()).not.toContain('access_token')
    expect(page.url()).not.toContain(RETURN_PATH)
  })

  test('says so when there is nowhere to go back to', async ({ page }) => {
    // The address typed in by hand, or a link kept from an earlier trip.
    await page.goto(
      `${RETURN_PATH}#access_token=stray&token_type=Bearer&state=nobody-asked`,
    )

    await expect(
      page.getByText(jaJP['google-auth:nowhere-to-return']),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: jaJP['google-auth:go-home'] }),
    ).toBeVisible()
    // And a token nobody asked for connects nothing.
    expect(await isConnected(page)).toBe(false)
  })

  test('ignores a token whose state is not the one it left with', async ({
    page,
  }) => {
    // Google is answered with the right shape and the wrong `state`: what a
    // forged or replayed link looks like.
    await page.route(
      'https://accounts.google.com/o/oauth2/v2/auth**',
      async (route) => {
        const asked = new URL(route.request().url())
        await route.fulfill({
          status: 302,
          headers: {
            location: `${asked.searchParams.get('redirect_uri')}#access_token=forged&token_type=Bearer&state=someone-else`,
          },
        })
      },
    )
    await page.goto(SETTINGS_SYNC)
    await hideDevOverlay(page)
    await page
      .getByRole('button', { name: jaJP['settings-page:google-drive-connect'] })
      .click()

    await expect(
      page.getByText(jaJP['google-auth:nowhere-to-return']),
    ).toBeVisible()
    expect(await isConnected(page)).toBe(false)
  })
})
