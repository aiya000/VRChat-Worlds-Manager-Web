import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { stubGoogleAuth } from './stub-google-auth'
import { stubGoogleDrive } from './stub-google-drive'

/**
 * Going to Google's sign-in and coming back without signing in (#159).
 *
 * A press that leaves for Google keeps its button busy on purpose: the page
 * is about to be replaced, and putting the button back for the last frame
 * before it goes is a flicker. Pressing back does not replace the page -- the
 * back/forward cache returns the very same JavaScript context -- so the busy
 * flags and the claim on `sync-activity` were all still set, and nothing
 * could be pressed again for as long as the tab lived.
 *
 * `staysPutOnTrip` is how that state is reached here: answering the departure
 * with "no content" leaves the browser exactly where it was, which is what a
 * restore hands back. Playwright's Chromium does not keep pages in the
 * back/forward cache, so `goBack()` would only give a fresh load -- the one
 * case where nothing is wrong. The restore itself is then the `pageshow` the
 * browser fires on the way back in.
 */

const SETTINGS = '/listview/settings'
const LIST_VIEW = '/listview/folders/special/all'

async function hideDevOverlay(page: Page) {
  // The dev server's error overlay sits above everything and swallows clicks
  // meant for what is underneath it.
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

async function openTheSyncTab(page: Page) {
  await page.goto(SETTINGS)
  await hideDevOverlay(page)
  await page
    .getByRole('tab', { name: jaJP['settings-page:section-sync'] })
    .click()
}

/** What the browser does to a page it is taking back out of its cache. */
async function restoreFromBackForwardCache(page: Page) {
  await page.evaluate(() => {
    window.dispatchEvent(
      new PageTransitionEvent('pageshow', { persisted: true }),
    )
  })
}

const syncButton = (page: Page) => page.getByTestId('drive-sync-button')
const connectButton = (page: Page) =>
  page.getByRole('button', {
    name: jaJP['settings-page:google-drive-connect'],
  })
const syncNowButton = (page: Page) =>
  page.getByRole('button', {
    name: jaJP['settings-page:google-drive-sync-now'],
  })
const successToast = (page: Page) =>
  page.getByText(jaJP['settings-page:google-drive-sync-success'])

test.describe('back from Google without signing in', () => {
  test('the list can sync again afterwards', async ({ page }) => {
    await stubGoogleDrive(page)
    // The first trip is the one that connects; the second is the press this
    // test is about.
    const google = await stubGoogleAuth(
      page,
      { token: 'test-access-token' },
      { staysPutOnTrip: 2 },
    )

    await openTheSyncTab(page)
    await connectButton(page).click()
    await expect(syncNowButton(page)).toBeVisible()

    // A fresh load of the list: a token lives only in the memory of the page
    // that fetched it, so the press below is one that has to leave again.
    await page.goto(LIST_VIEW)
    await hideDevOverlay(page)

    await syncButton(page).click()
    await page.getByLabel(jaJP['explanation:dont-show-again']).click()
    await page
      .getByRole('button', { name: jaJP['sync-explanation:action-sync'] })
      .click()

    // Left for Google, and stayed put. This is the state #159 is about.
    await expect.poll(() => google.trips()).toBe(2)
    await expect(syncButton(page)).toBeDisabled()

    await restoreFromBackForwardCache(page)

    await expect(syncButton(page)).toBeEnabled()

    // Not merely enabled: the claim on the sync itself has to have been given
    // back too, or the press is refused before anything happens.
    await syncButton(page).click()
    await expect(successToast(page)).toBeVisible()
  })

  test('the settings can connect again afterwards', async ({ page }) => {
    await stubGoogleDrive(page)
    const google = await stubGoogleAuth(
      page,
      { token: 'test-access-token' },
      { staysPutOnTrip: 1 },
    )

    await openTheSyncTab(page)
    await connectButton(page).click()

    await expect.poll(() => google.trips()).toBe(1)
    await expect(connectButton(page)).toBeDisabled()

    await restoreFromBackForwardCache(page)

    await expect(connectButton(page)).toBeEnabled()

    await connectButton(page).click()
    await expect(syncNowButton(page)).toBeVisible()
  })
})
