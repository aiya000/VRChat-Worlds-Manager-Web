import { expect, test, type Page } from '@playwright/test'
import { seedWorld } from './seed-world'
import { UI_SCALES } from '../../src/lib/ui-scale'

const LIST_VIEW = '/listview/folders/special/all'
const VIEWPORT = { width: 1280, height: 800 }
const WORLD_ID = 'wrld_zoom_dialog'
const WORLD_NAME = 'DialogWorld'

test.use({ viewport: VIEWPORT, serviceWorkers: 'block' })

async function scaleTo(page: Page, percent: number) {
  await page.goto('/listview/settings')
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  const readout = page.getByTestId('ui-scale-stepper')
  for (let press = 0; press < UI_SCALES.length; press++) {
    if ((await readout.innerText()) === `${percent}%`) {
      return
    }
    await page.getByTestId('ui-scale-stepper-increase').click()
  }
  throw new Error(`could not reach ${percent}%`)
}

/**
 * `vh` answers in the screen's own pixels and is then multiplied by the zoom,
 * so the world detail -- sized at `70vh` -- became 140% of the screen at 200%,
 * and its heading and close button sat above the top of the window.
 */
test.describe('a dialog while the interface is drawn larger', () => {
  for (const scale of UI_SCALES) {
    test(`keeps the world detail on screen at ${scale}%`, async ({ page }) => {
      await page.goto(LIST_VIEW)
      await seedWorld(page, { worldId: WORLD_ID, name: WORLD_NAME })
      await scaleTo(page, scale)

      await page.goto(LIST_VIEW)
      await page.addStyleTag({
        content: 'nextjs-portal { display: none !important; }',
      })
      await page.getByText(WORLD_NAME).first().click()

      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      // Radix grows the dialog into place, so the first box is mid-animation.
      await expect
        .poll(
          async () => {
            const box = (await dialog.boundingBox())!
            return box.y >= 0 && box.y + box.height <= VIEWPORT.height
          },
          { message: `the dialog never settled on screen at ${scale}%` },
        )
        .toBe(true)
    })
  }
})
