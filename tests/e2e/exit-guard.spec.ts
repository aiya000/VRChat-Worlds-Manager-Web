import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 800 }

const WARNING = jaJP['exit-guard:press-back-again']
const SETTINGS_LABEL = jaJP['general:settings']
const GUIDE_LABEL = jaJP['app-sidebar:guide']

const START = '/listview/folders/special/all'

/**
 * Chrome's back gesture skips every history entry a page added without a
 * user gesture, and `page.goBack()` does not: a guard the gesture would go
 * straight past looks perfectly fine to it, which is how three fixes for #188
 * passed here and failed on a phone. What Chromium does expose is the moment
 * it marks an entry as one to skip -- as a DevTools issue -- so that is what
 * these specs watch, alongside the history itself.
 *
 * Everything here is read over the raw protocol on purpose. Playwright's
 * `page.evaluate()` (and every locator, which evaluates too) runs as if from
 * a user gesture, and a document that has had one is a document Chrome no
 * longer marks. Read that way, "nothing has touched the app yet" would be a
 * lie by the time it was checked.
 */
async function attach(page: Page) {
  const cdp = await page.context().newCDPSession(page)
  const skipped: string[] = []
  cdp.on('Audits.issueAdded', ({ issue }) => {
    const details = issue.details.genericIssueDetails
    if (details?.errorType === 'NavigationEntryMarkedSkippable') {
      skipped.push(details.request?.url ?? '?')
    }
  })
  await cdp.send('Audits.enable')

  const history = async () => {
    const { result } = await cdp.send('Runtime.evaluate', {
      expression: `JSON.stringify({
        length: history.length,
        guard: history.state?.__exitGuard ?? null,
        stop: history.state?.__exitStop ?? null,
        touched: navigator.userActivation.hasBeenActive,
      })`,
      returnByValue: true,
    })
    return JSON.parse(result.value as string) as {
      length: number
      guard: true | null
      stop: true | null
      touched: boolean
    }
  }

  return {
    /** Every entry Chromium has marked as one the back gesture will skip. */
    skipped: () => skipped,
    history,
  }
}

/**
 * A tap that leads nowhere: the sidebar's own button, closed again at once.
 * What it is for is the user activation it grants the document.
 */
async function touch(page: Page) {
  await page.locator('[data-sidebar="trigger"]').tap()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toBeHidden()
}

async function goDeeper(page: Page, label: string) {
  await page.locator('[data-sidebar="trigger"]').tap()
  await page.getByRole('dialog').getByText(label).tap()
}

async function hideDevOverlay(page: Page) {
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

/**
 * Makes the page look like the app launched from the home screen, which is how
 * a phone runs it. `isRunningInstalled()` reads the display mode, so answering
 * `standalone` there is the whole of it.
 */
async function pretendInstalled(page: Page) {
  await page.addInitScript(() => {
    const real = window.matchMedia.bind(window)
    window.matchMedia = (query: string) =>
      query.includes('display-mode: standalone')
        ? ({
            matches: true,
            media: query,
            onchange: null,
            addEventListener() {},
            removeEventListener() {},
            addListener() {},
            removeListener() {},
            dispatchEvent: () => false,
          } as unknown as MediaQueryList)
        : real(query)
  })
}

/**
 * Playwright opens `about:blank` before it goes anywhere, so every page it
 * drives has one entry behind it and the app would rightly leave the back
 * gesture alone. Saying the history is one entry long is what a launch into
 * a fresh tab looks like. Only the first read -- the one the decision is
 * made on -- is answered that way; the guard is itself a history entry, and
 * a length that stayed at 1 would hide one being pushed.
 */
async function pretendNothingIsBehind(page: Page) {
  await page.addInitScript(() => {
    const real = Object.getOwnPropertyDescriptor(History.prototype, 'length')
    let asked = false
    Object.defineProperty(window.history, 'length', {
      configurable: true,
      get() {
        if (asked) {
          return real?.get?.call(window.history)
        }
        asked = true
        return 1
      },
    })
  })
}

// The service worker is blocked so that `page.route()` sees the sign-in
// check the launch screen makes; the worker would otherwise make it itself.
test.describe('leaving an installed app by pressing back', () => {
  test.use({
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
    serviceWorkers: 'block',
  })

  test.beforeEach(async ({ page }) => {
    await pretendInstalled(page)
    await page.addInitScript(() => {
      localStorage.setItem('setupComplete', 'true')
    })
    await page.route('**/auth/user*', (route) =>
      route.fulfill({ status: 200, body: '{}' }),
    )
  })

  // Chrome would skip an entry added before the user has touched the app, so
  // adding one would only pretend to guard. Nothing is added, and nothing is
  // marked: this is the launch that used to close at the first press (#188).
  test('adds nothing to the history until the user has touched the app', async ({
    page,
  }) => {
    const chrome = await attach(page)

    await page.goto('/')
    await page.waitForURL(/\/listview/)
    await page.waitForTimeout(1000)

    expect(await chrome.history()).toEqual({
      length: 2,
      guard: null,
      stop: null,
      touched: false,
    })
    expect(chrome.skipped()).toEqual([])
  })

  test('puts an entry of its own between the app and the way out at the first tap', async ({
    page,
  }) => {
    const chrome = await attach(page)
    await page.goto('/')
    await page.waitForURL(/\/listview/)
    await hideDevOverlay(page)

    await touch(page)

    await expect
      .poll(() => chrome.history())
      .toMatchObject({
        length: 3,
        guard: true,
      })
    expect(chrome.skipped()).toEqual([])
  })

  test('says what the next press will do, rather than leaving', async ({
    page,
  }) => {
    const chrome = await attach(page)
    await page.goto('/')
    await page.waitForURL(/\/listview/)
    await hideDevOverlay(page)
    await touch(page)
    await expect.poll(() => chrome.history()).toMatchObject({ guard: true })

    await page.goBack()

    await expect(page.getByText(WARNING)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${START}$`))
    // Nothing of the app's is in the way any more: the next press is the
    // browser's own, which is what closes the app.
    expect(await chrome.history()).toMatchObject({
      guard: null,
      stop: true,
    })
  })

  // A press of back ends the user activation as far as Chrome's skipping is
  // concerned, so an entry put back on a timer would be one the gesture
  // skips. The way out stays open until the user touches the app again.
  test('puts the entry back at the next tap, not on its own', async ({
    page,
  }) => {
    const chrome = await attach(page)
    await page.goto('/')
    await page.waitForURL(/\/listview/)
    await hideDevOverlay(page)
    await touch(page)
    await expect.poll(() => chrome.history()).toMatchObject({ guard: true })
    await page.goBack()
    await expect(page.getByText(WARNING)).toBeVisible()

    await page.waitForTimeout(3000)
    expect(await chrome.history()).toMatchObject({ guard: null })
    expect(chrome.skipped()).toEqual([])

    await touch(page)

    await expect.poll(() => chrome.history()).toMatchObject({ guard: true })
    expect(chrome.skipped()).toEqual([])
  })

  test('leaves a press from deeper in the app alone', async ({ page }) => {
    const chrome = await attach(page)
    await page.goto('/')
    await page.waitForURL(/\/listview/)
    await hideDevOverlay(page)
    await touch(page)
    await expect.poll(() => chrome.history()).toMatchObject({ guard: true })
    await goDeeper(page, SETTINGS_LABEL)
    await expect(page).toHaveURL(/\/listview\/settings/)

    await page.goBack()

    await expect(page).toHaveURL(new RegExp(`${START}$`))
    await expect(page.getByText(WARNING)).toHaveCount(0)
    expect(chrome.skipped()).toEqual([])
  })

  // Two screens deep, the first press lands on a screen that is neither the
  // guard nor the entry below it. That used to read as leaving.
  test('leaves a press two screens deep alone as well', async ({ page }) => {
    const chrome = await attach(page)
    await page.goto('/')
    await page.waitForURL(/\/listview/)
    await hideDevOverlay(page)
    await touch(page)
    await expect.poll(() => chrome.history()).toMatchObject({ guard: true })
    await goDeeper(page, SETTINGS_LABEL)
    await expect(page).toHaveURL(/\/listview\/settings/)
    await goDeeper(page, GUIDE_LABEL)
    await expect(page).toHaveURL(/\/listview\/guide/)

    await page.goBack()
    await expect(page).toHaveURL(/\/listview\/settings/)
    await expect(page.getByText(WARNING)).toHaveCount(0)

    await page.goBack()
    await expect(page).toHaveURL(new RegExp(`${START}$`))
    await expect(page.getByText(WARNING)).toHaveCount(0)

    await page.goBack()
    await expect(page.getByText(WARNING)).toBeVisible()
    expect(chrome.skipped()).toEqual([])
  })

  test('stands again after a reload of its own entry', async ({ page }) => {
    const chrome = await attach(page)
    await page.goto('/')
    await page.waitForURL(/\/listview/)
    await hideDevOverlay(page)
    await touch(page)
    await expect.poll(() => chrome.history()).toMatchObject({ guard: true })

    await page.reload()
    await hideDevOverlay(page)
    expect(await chrome.history()).toMatchObject({ guard: true })

    await page.goBack()

    await expect(page.getByText(WARNING)).toBeVisible()
  })

  // The whole way a phone travels: in through the screen the app starts at,
  // deeper into the app, and back out again. Each press has to answer for
  // itself -- the screen below first, then the warning, then the way out.
  test('walks back out of the app the way it walked in', async ({ page }) => {
    const chrome = await attach(page)
    await page.goto('/')
    await page.waitForURL(/\/listview/)
    await hideDevOverlay(page)
    await touch(page)
    await expect.poll(() => chrome.history()).toMatchObject({ guard: true })
    await goDeeper(page, SETTINGS_LABEL)
    await expect(page).toHaveURL(/\/listview\/settings/)

    await page.goBack()
    await expect(page).toHaveURL(/special\/all/)
    await expect(page.getByText(WARNING)).toHaveCount(0)

    await page.goBack()
    await expect(page.getByText(WARNING)).toBeVisible()

    await page.goBack()
    await expect.poll(() => page.url()).toBe('about:blank')
    expect(chrome.skipped()).toEqual([])
  })
})

// The screen the app is launched at decides where to start by asking VRChat,
// which takes a second or three on a phone. Back closes the app in those
// seconds, and there is nothing the app can put up that Chrome would let the
// gesture stop at before the user has touched it (#188). What it must not do
// is pretend: an entry pushed here would be marked and skipped, and the
// history would carry it out of the app all the same.
test.describe('pressing back while the app is still starting up', () => {
  test.use({
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
    serviceWorkers: 'block',
  })

  const DECIDING_MS = 3000

  test('leaves, and the app has not pretended otherwise', async ({ page }) => {
    const chrome = await attach(page)
    await pretendInstalled(page)
    await page.addInitScript(() => {
      localStorage.setItem('setupComplete', 'true')
    })
    await page.route('**/auth/user*', async (route) => {
      await new Promise((settle) => setTimeout(settle, DECIDING_MS))
      await route.fulfill({ status: 401, body: '{}' })
    })

    await page.goto('/')
    await page.waitForTimeout(500)
    expect(await chrome.history()).toMatchObject({
      guard: null,
      stop: null,
    })
    expect(chrome.skipped()).toEqual([])

    await page.goBack()

    await expect.poll(() => page.url()).toBe('about:blank')
  })
})

test.describe('a browser tab on a phone', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true })

  test('is guarded when there is nothing behind the app', async ({ page }) => {
    const chrome = await attach(page)
    await pretendNothingIsBehind(page)
    await page.goto(START)
    await hideDevOverlay(page)

    await touch(page)

    await expect.poll(() => chrome.history()).toMatchObject({ guard: true })
    expect(chrome.skipped()).toEqual([])
  })

  // Back means "the page I was on before", which is not leaving: the tab's
  // own `about:blank` is behind the app here.
  test('is left alone when back means the page before the app', async ({
    page,
  }) => {
    const chrome = await attach(page)
    await page.goto(START)
    await hideDevOverlay(page)

    await touch(page)

    await page.waitForTimeout(500)
    expect(await chrome.history()).toMatchObject({
      length: 2,
      guard: null,
    })
  })
})

test.describe('pressing back where it would not leave the app', () => {
  test.use({ viewport: DESKTOP, hasTouch: false, isMobile: false })

  // A desktop browser showing the first page of a tab does nothing at all when
  // back is pressed, so there is nothing to warn about and no entry to spend.
  test('is left alone on a browser with no back gesture', async ({ page }) => {
    const chrome = await attach(page)
    await pretendNothingIsBehind(page)
    await page.goto(START)
    await hideDevOverlay(page)

    await page.locator('[data-sidebar="trigger"]').click()
    await page.keyboard.press('Escape')

    await page.waitForTimeout(500)
    expect(await chrome.history()).toMatchObject({ guard: null })
  })

  // The screen the app is launched at decides where to start and then replaces
  // itself. Left in the history, it sent the app straight forward again every
  // time back reached it, and there was no way out at all.
  test('does not land back on the screen the app started at', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForURL(/\/setup/)

    await page.goBack()

    // Straight out of the app, to the blank page Playwright opened before it.
    // Asserted by polling rather than by reading the URL once: the screen the
    // app starts at used to appear for an instant on the way past, and then
    // send the app forward again.
    await expect.poll(() => page.url()).toBe('about:blank')
  })
})
