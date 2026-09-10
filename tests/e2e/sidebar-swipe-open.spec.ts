import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 800 }

const SETTINGS_LABEL = jaJP['general:settings']

interface Point {
  x: number
  y: number
}

/**
 * The project runs a desktop Chrome, which reports no touch, so nothing here
 * arrives as a touch of its own. Chromium still builds `TouchEvent`, so the
 * gesture can be handed to the page directly -- which is all this needs: the
 * drawer listens for the events, it does not ask the device about them.
 */
async function swipe(page: Page, from: Point, to: Point) {
  await page.evaluate(
    ([start, end]) => {
      const send = (type: string, at: { x: number; y: number }) => {
        const target = document.elementFromPoint(at.x, at.y) ?? document.body
        const touch = new Touch({
          identifier: 1,
          target,
          clientX: at.x,
          clientY: at.y,
        })
        const ongoing = type === 'touchend' ? [] : [touch]
        target.dispatchEvent(
          new TouchEvent(type, {
            bubbles: true,
            cancelable: true,
            touches: ongoing,
            targetTouches: ongoing,
            changedTouches: [touch],
          }),
        )
      }

      send('touchstart', start)
      send('touchmove', { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 })
      send('touchend', end)
    },
    [from, to] as const,
  )
}

async function open(page: Page, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport)
  await page.goto('/listview/recently-visited')
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

test.describe('opening the sidebar by swiping', () => {
  test('a swipe to the right opens the drawer on a phone', async ({ page }) => {
    await open(page, PHONE)

    await swipe(page, { x: 30, y: 500 }, { x: 260, y: 510 })

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(
      page.getByRole('dialog').getByText(SETTINGS_LABEL),
    ).toBeVisible()
  })

  test('a swipe to the left leaves it shut', async ({ page }) => {
    await open(page, PHONE)

    await swipe(page, { x: 300, y: 500 }, { x: 60, y: 510 })

    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  test('a scroll that drifted sideways leaves it shut', async ({ page }) => {
    await open(page, PHONE)

    await swipe(page, { x: 60, y: 200 }, { x: 200, y: 620 })

    await expect(page.getByRole('dialog')).toHaveCount(0)
  })

  // The gesture is the phone's answer to a sidebar that is not on screen. On a
  // desktop it is already there, and a touchscreen laptop swiping over the
  // content has not asked for a drawer.
  test('a swipe does nothing at a desktop width', async ({ page }) => {
    await open(page, DESKTOP)

    await swipe(page, { x: 500, y: 500 }, { x: 800, y: 510 })

    await expect(page.getByRole('dialog')).toHaveCount(0)
  })
})
