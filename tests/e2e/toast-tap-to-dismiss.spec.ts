import { expect, test, type Locator, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { stubGoogleAuth } from './stub-google-auth'

const SETTINGS_SYNC = '/listview/settings?tab=sync'

test.use({ serviceWorkers: 'block' })

interface Point {
  x: number
  y: number
}

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
 * Where the toast is once it has stopped moving.
 *
 * A toast is visible from the moment it is in the DOM, but it slides in from
 * below over sonner's 400ms, so a box taken straight away is of somewhere it
 * is passing through -- a fast machine caught it settled and CI did not.
 */
async function settledCentre(toast: Locator): Promise<Point> {
  await expect(toast).toHaveAttribute('data-mounted', 'true')
  await toast.evaluate((element) =>
    Promise.all(
      element
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished.catch(() => undefined)),
    ),
  )
  const box = (await toast.boundingBox())!
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

/**
 * A finger on the screen, delivered as Chrome delivers one.
 *
 * Sonner reads pointer events, and a `TouchEvent` built in the page (the way
 * `sidebar-swipe.spec.ts` does it) never becomes one. A mouse drag does reach
 * sonner, but ends in a `click` -- Chrome fires one however far a mouse moved
 * between down and up -- and a click is now a way to put a toast away, so a
 * mouse cannot show that a swipe is not. A touch through CDP is the phone's
 * gesture as the page sees it: pointer events for sonner, touch events for
 * the sidebar, and no click once the finger has moved.
 */
async function touch(page: Page, at: Point) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [at],
  })
  return {
    async moveTo(to: Point, steps = 6) {
      for (let step = 1; step <= steps; step += 1) {
        await cdp.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [
            {
              x: at.x + ((to.x - at.x) * step) / steps,
              y: at.y + ((to.y - at.y) * step) / steps,
            },
          ],
        })
      }
    },
    async lift() {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      })
      await cdp.detach()
    },
  }
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

  test('a sideways swipe is not a way any more', async ({ page }) => {
    const toast = await raiseAToast(page)
    const centre = await settledCentre(toast)

    const finger = await touch(page, centre)
    await finger.moveTo({ x: centre.x + 160, y: centre.y })

    // The finger did reach sonner -- it is holding the toast -- and the toast
    // did not go with it. Without the first, the second would prove nothing.
    await expect(toast).toHaveAttribute('data-swiping', 'true')
    await expect(toast).toHaveAttribute('data-swiped', 'false')

    await finger.lift()

    await page.waitForTimeout(500)
    await expect(toast).toBeVisible()
  })

  test('a swipe down still is', async ({ page }) => {
    const toast = await raiseAToast(page)
    const centre = await settledCentre(toast)

    const finger = await touch(page, centre)
    await finger.moveTo({ x: centre.x, y: centre.y + 120 })
    await expect(toast).toHaveAttribute('data-swiped', 'true')
    await finger.lift()

    await expect(toast).toBeHidden({ timeout: 1500 })
  })
})
