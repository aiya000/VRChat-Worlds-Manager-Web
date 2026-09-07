import { expect, test, type Page } from '@playwright/test'
import { UI_SCALES } from '../../src/lib/ui-scale'

const SETTINGS = '/listview/settings'
const VIEWPORT = { width: 1280, height: 800 }

test.use({ viewport: VIEWPORT })

async function openSettings(page: Page) {
  await page.goto(SETTINGS)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

/** Steps the settings stepper up until it reads `percent`. */
async function scaleTo(page: Page, percent: number) {
  const readout = page.getByTestId('ui-scale-stepper')
  for (let press = 0; press < UI_SCALES.length; press++) {
    const current = Number((await readout.innerText()).replace('%', ''))
    if (current === percent) {
      return
    }
    await page.getByTestId('ui-scale-stepper-increase').click()
  }
  throw new Error(`could not reach ${percent}%`)
}

function isOnScreen(box: {
  x: number
  y: number
  width: number
  height: number
}) {
  return (
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= VIEWPORT.width &&
    box.y + box.height <= VIEWPORT.height
  )
}

/**
 * Radix measures a trigger in device pixels and writes the answer as a
 * transform inside the zoomed document, so the offset used to be multiplied by
 * the zoom a second time. At 200% a select's options landed at x=1826 in a
 * 1280px window -- including the options of the control that sets the scale,
 * which made scaling up a one-way door.
 */
test.describe('popovers while the interface is drawn larger', () => {
  for (const scale of UI_SCALES) {
    test(`keeps a select's options on screen at ${scale}%`, async ({
      page,
    }) => {
      await openSettings(page)
      await scaleTo(page, scale)

      await page.getByTestId('language-select').click()
      const option = page.getByRole('option', { name: 'English', exact: true })
      await expect(option).toBeVisible()

      const box = (await option.boundingBox())!
      expect(
        isOnScreen(box),
        `at ${scale}% the option was drawn at ${JSON.stringify(box)}`,
      ).toBe(true)
    })
  }

  test('draws the options at the size the rest of the interface is', async ({
    page,
  }) => {
    await openSettings(page)
    await page.getByTestId('language-select').click()
    const option = page.getByRole('option', { name: 'English', exact: true })
    await expect(option).toBeVisible()
    const atFullSize = (await option.boundingBox())!.height
    await page.keyboard.press('Escape')

    await scaleTo(page, 200)
    await page.getByTestId('language-select').click()
    await expect(option).toBeVisible()
    const atDoubleSize = (await option.boundingBox())!.height

    // Undoing the zoom to fix the position must not leave the popover drawn
    // at the old size while everything around it grew.
    expect(atDoubleSize).toBeGreaterThan(atFullSize * 1.8)
  })
})
