import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 800 }

const WARNING = jaJP['exit-guard:press-back-again']
const SETTINGS_LABEL = jaJP['general:settings']

const START = '/listview/folders/special/all'

/**
 * Playwright opens `about:blank` before it goes anywhere, so every page it
 * drives has one entry behind it and the app would rightly leave the back
 * gesture alone. Saying the history is one entry long is what a launch from
 * the home screen looks like, which is the case being tested.
 */
async function pretendNothingIsBehind(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window.history, 'length', { get: () => 1 })
  })
}

async function open(page: Page) {
  await page.goto(START)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

const guardEntry = (page: Page) =>
  page.evaluate(
    () => (history.state as { __exitGuard?: boolean } | null)?.__exitGuard,
  )

test.describe('leaving the app by pressing back', () => {
  test.use({ viewport: PHONE, hasTouch: true, isMobile: true })

  test.beforeEach(async ({ page }) => {
    await pretendNothingIsBehind(page)
  })

  test('puts an entry of its own between the app and the way out', async ({
    page,
  }) => {
    await open(page)

    await expect.poll(() => guardEntry(page)).toBe(true)
  })

  test('says what the next press will do, rather than leaving', async ({
    page,
  }) => {
    await open(page)
    await expect.poll(() => guardEntry(page)).toBe(true)

    await page.goBack()

    await expect(page.getByText(WARNING)).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${START}$`))
    // Nothing of the app's is in the way any more: the next press is the
    // browser's own, which is what closes the app.
    expect(await guardEntry(page)).toBeUndefined()
  })

  test('puts the entry back when the moment passes unused', async ({
    page,
  }) => {
    await open(page)
    await expect.poll(() => guardEntry(page)).toBe(true)

    await page.goBack()
    await expect(page.getByText(WARNING)).toBeVisible()

    await expect.poll(() => guardEntry(page), { timeout: 10_000 }).toBe(true)
  })

  // The app is launched at `/`, which only decides where to start and then
  // replaces itself. Guarding that entry would put the splash screen back on
  // screen on the way out, so the guard waits for the app to settle.
  test('guards where the app settles, not the screen it starts at', async ({
    page,
  }) => {
    await page.goto('/')
    await page.waitForURL(/\/setup/)
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })
    await expect.poll(() => guardEntry(page)).toBe(true)

    await page.goBack()

    await expect(page.getByText(WARNING)).toBeVisible()
    await expect(page).toHaveURL(/\/setup/)
  })

  test('leaves a press from deeper in the app alone', async ({ page }) => {
    await open(page)
    await expect.poll(() => guardEntry(page)).toBe(true)
    await page.locator('[data-sidebar="trigger"]').click()
    await page.getByRole('dialog').getByText(SETTINGS_LABEL).click()
    await expect(page).toHaveURL(/\/listview\/settings/)

    await page.goBack()

    await expect(page).toHaveURL(new RegExp(`${START}$`))
    await expect(page.getByText(WARNING)).toHaveCount(0)
  })
})

test.describe('pressing back where it would not leave the app', () => {
  test.use({ viewport: DESKTOP, hasTouch: false, isMobile: false })

  // A desktop browser showing the first page of a tab does nothing at all when
  // back is pressed, so there is nothing to warn about and no entry to spend.
  test('is left alone on a browser with no back gesture', async ({ page }) => {
    await pretendNothingIsBehind(page)
    await open(page)
    await expect(page.locator('[data-sidebar="trigger"]')).toBeVisible()

    expect(await guardEntry(page)).toBeUndefined()
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
