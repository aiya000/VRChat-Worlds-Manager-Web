import { expect, test, type Locator, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedFolders } from './seed-folders'
import { seedWorld } from './seed-world'

const LIST_VIEW = '/listview/folders/special/all'
const FOLDER = 'Horror'
const WORLD_ID = 'wrld_e2e_dragged'
const WORLD_NAME = 'A Draggable World'

function folderRow(page: Page) {
  return page.locator('[data-folder-list]').getByText(FOLDER, { exact: true })
}

function card(page: Page) {
  return page.locator(`#${WORLD_ID} [data-world-drag]`)
}

/** Picks the card up with the mouse and carries it, in steps, onto `target`. */
async function drag(page: Page, from: Locator, target: Locator) {
  const start = await from.boundingBox()
  const end = await target.boundingBox()
  if (start === null || end === null) {
    throw new Error('the card or the folder is not on screen')
  }
  const x0 = start.x + start.width / 2
  const y0 = start.y + start.height / 2
  const x1 = end.x + end.width / 2
  const y1 = end.y + end.height / 2

  await page.mouse.move(x0, y0)
  await page.mouse.down()
  for (let step = 1; step <= 12; step++) {
    await page.mouse.move(
      x0 + ((x1 - x0) * step) / 12,
      y0 + ((y1 - y0) * step) / 12,
    )
  }
}

test.describe('dragging a world card onto a folder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIST_VIEW)
    await seedFolders(page, [FOLDER, 'Chill'])
    await seedWorld(page, { worldId: WORLD_ID, name: WORLD_NAME })
    await page.goto(LIST_VIEW)
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })
    await expect(card(page)).toBeVisible()
    await expect(folderRow(page)).toBeVisible()
  })

  test('lights the folder block up while the card is in the air, and puts the world in on drop', async ({
    page,
  }) => {
    const block = page.locator('[data-folder-block]')
    await expect(block).not.toHaveAttribute('data-drop-active', 'true')

    await drag(page, card(page), folderRow(page))

    await expect(block).toHaveAttribute('data-drop-active', 'true')
    await expect(page.getByTestId('dragged-world')).toContainText(WORLD_NAME)
    await expect(
      page.locator('[data-drop-over="true"]').getByText(FOLDER),
    ).toBeVisible()

    await page.mouse.up()

    await expect(
      page.getByText(
        jaJP['world-drag:added-to-folder']
          .replace('{0}', WORLD_NAME)
          .replace('{1}', FOLDER),
      ),
    ).toBeVisible()
    // The count beside the folder is what says the world is really in it.
    await expect(
      page.locator('[data-folder-list]').getByText(`(1)`).first(),
    ).toBeVisible()
    await expect(block).not.toHaveAttribute('data-drop-active', 'true')

    await page.goto(`/listview/folders/userFolder?folderName=${FOLDER}`)
    await expect(page.getByText(WORLD_NAME)).toBeVisible()
  })

  test('says so instead of adding twice when the world is already there', async ({
    page,
  }) => {
    await drag(page, card(page), folderRow(page))
    await page.mouse.up()
    await expect(
      page.locator('[data-folder-list]').getByText(`(1)`).first(),
    ).toBeVisible()

    await drag(page, card(page), folderRow(page))
    await page.mouse.up()

    await expect(
      page.getByText(
        jaJP['world-drag:already-in-folder']
          .replace('{0}', WORLD_NAME)
          .replace('{1}', FOLDER),
      ),
    ).toBeVisible()
    await expect(
      page.locator('[data-folder-list]').getByText('(2)'),
    ).toHaveCount(0)
  })

  test('a plain click still opens the card', async ({ page }) => {
    await card(page).click()

    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(
      page.getByRole('dialog').getByText(WORLD_NAME).first(),
    ).toBeVisible()
  })

  test('letting go anywhere else changes nothing', async ({ page }) => {
    const box = await card(page).boundingBox()
    if (box === null) {
      throw new Error('the card is not on screen')
    }
    await page.mouse.move(box.x + 10, box.y + 10)
    await page.mouse.down()
    await page.mouse.move(box.x + 120, box.y + 120, { steps: 8 })
    await page.mouse.up()

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(
      page.locator('[data-folder-list]').getByText('(1)'),
    ).toHaveCount(0)
  })
})
