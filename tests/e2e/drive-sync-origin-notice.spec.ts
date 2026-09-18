import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { stubGoogleAuth } from './stub-google-auth'

const SETTINGS_SYNC = '/listview/settings?tab=sync'
const LIST_VIEW = '/listview/folders/special/all'

/** The address the app is still served at but Google no longer signs in from. */
const PAGES_DEV = 'https://vrchat-worlds-manager-web.pages.dev'

/** Where the dev server under test actually is -- `baseURL` in `playwright.config.ts`. */
const LOCAL = 'http://127.0.0.1:3456'

test.use({ serviceWorkers: 'block' })

/**
 * Serves the app under test as if from `pages.dev`: every request the browser
 * makes to that host is answered by the local dev server, so the page runs
 * with `location.hostname` set to the address in question and nothing else
 * changed.
 */
async function serveAsPagesDev(page: Page) {
  await page.route(`${PAGES_DEV}/**`, async (route) => {
    const asked = new URL(route.request().url())
    const response = await route.fetch({
      url: `${LOCAL}${asked.pathname}${asked.search}`,
    })
    await route.fulfill({ response })
  })
}

async function hideDevOverlay(page: Page) {
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

const NOTICE_TEXT = jaJP['drive-origin:unavailable-here'].replace(
  '{0}',
  'vrchat-worlds-manager-web.pages.dev',
)

/**
 * `pages.dev` was taken off the OAuth client's authorised domains when brand
 * verification moved to `vrcww.com` (#107). The app still answers there, and
 * everything but Drive sync still works, so it has to say so where sync is
 * reached for, and say where to go -- rather than let Google's refusal be
 * the explanation (#205).
 */
test.describe('at pages.dev, where Google will not sign in', () => {
  test('the sync tab is the notice and nothing else', async ({ page }) => {
    await serveAsPagesDev(page)
    await page.goto(`${PAGES_DEV}${SETTINGS_SYNC}`)
    await hideDevOverlay(page)

    const notice = page.getByTestId('drive-sync-origin-notice')
    await expect(notice).toBeVisible()
    await expect(notice).toContainText(NOTICE_TEXT)
    await expect(notice).toContainText(jaJP['drive-origin:move'])

    // The link goes where sync works, in a new tab: a PWA installed here
    // should not be navigated away from the site it was installed from.
    const link = notice.getByRole('link', { name: jaJP['drive-origin:open'] })
    await expect(link).toHaveAttribute('href', 'https://vrcww.com/start')
    await expect(link).toHaveAttribute('target', '_blank')

    // Every card this tab normally holds ends in a trip to Google that this
    // address cannot make -- connect, sync now, push to every device -- so
    // none of them is offered, and neither is the VR notice about making
    // that trip succeed.
    await expect(page.getByTestId('google-drive-section')).toBeHidden()
    await expect(
      page.getByRole('button', {
        name: jaJP['settings-page:google-drive-connect'],
        exact: true,
      }),
    ).toBeHidden()
    await expect(
      page.getByText(jaJP['settings-page:push-settings-title']),
    ).toBeHidden()
    await expect(page.getByTestId('vr-projection-notice')).toBeHidden()
  })

  test("the list's sync button explains instead of leading to the settings", async ({
    page,
  }) => {
    await serveAsPagesDev(page)
    await page.goto(`${PAGES_DEV}${LIST_VIEW}`)
    await hideDevOverlay(page)

    await page.getByTestId('drive-sync-button').click()

    const dialog = page.getByTestId('drive-sync-origin-dialog')
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText(NOTICE_TEXT)
    await expect(
      dialog.getByRole('button', { name: jaJP['drive-origin:open'] }),
    ).toBeVisible()
    // Not the usual "connect" explanation, which would send the reader to a
    // connect button that is disabled.
    await expect(page.getByTestId('sync-explanation')).toBeHidden()
    // And the page stayed where it was.
    expect(new URL(page.url()).pathname).toBe(LIST_VIEW)
  })

  test('a device that connected here before the move is told the same, and does not leave', async ({
    page,
  }) => {
    await serveAsPagesDev(page)
    // Google would answer a trip from here with `redirect_uri_mismatch`, so
    // the trip itself is the thing to see not happen.
    const google = await stubGoogleAuth(page, { token: 'unused' })
    await page.goto(`${PAGES_DEV}${LIST_VIEW}`)
    await hideDevOverlay(page)
    await markConnected(page)
    await page.reload()
    await hideDevOverlay(page)

    const button = page.getByTestId('drive-sync-button')
    await expect(button).toContainText(jaJP['list-view:sync'])
    await button.click()

    await expect(page.getByTestId('drive-sync-origin-dialog')).toBeVisible()
    // Neither the pre-sync explanation nor the sync itself.
    await expect(page.getByTestId('sync-explanation')).toBeHidden()
    expect(google.trips()).toBe(0)
    expect(new URL(page.url()).pathname).toBe(LIST_VIEW)
  })
})

/** What a successful connect leaves behind, written the way the app reads it. */
async function markConnected(page: Page) {
  await page.evaluate(async () => {
    const open = async (): Promise<IDBDatabase> => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const db = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open('VRChatWorldsManager')
          request.onsuccess = () => resolve(request.result)
          request.onerror = () => reject(request.error)
        })
        if (db.objectStoreNames.contains('googleAuthState')) {
          return db
        }
        db.close()
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error('the googleAuthState store never appeared')
    }
    const db = await open()
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('googleAuthState', 'readwrite')
      transaction
        .objectStore('googleAuthState')
        .put({ key: 'connected', value: 'true' })
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
    })
    db.close()
  })
}

test.describe('at an address Google does sign in from', () => {
  test('nothing about pages.dev is said, and connecting works as before', async ({
    page,
  }) => {
    await stubGoogleAuth(page, { token: 'unused' })
    await page.goto(SETTINGS_SYNC)
    await hideDevOverlay(page)

    await expect(page.getByTestId('vr-projection-notice')).toBeVisible()
    await expect(page.getByTestId('drive-sync-origin-notice')).toBeHidden()
    await expect(
      page.getByRole('button', {
        name: jaJP['settings-page:google-drive-connect'],
        exact: true,
      }),
    ).toBeEnabled()
  })

  test("the list's sync button still offers the usual explanation", async ({
    page,
  }) => {
    await page.goto(LIST_VIEW)
    await hideDevOverlay(page)

    await page.getByTestId('drive-sync-button').click()

    await expect(page.getByTestId('sync-explanation')).toBeVisible()
    await expect(page.getByTestId('drive-sync-origin-dialog')).toBeHidden()
  })
})
