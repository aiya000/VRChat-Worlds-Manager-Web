import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { UI_SCALES } from '../../src/lib/ui-scale'
import { seedWorld } from './seed-world'

const SETTINGS = '/listview/settings'
const LIST_VIEW = '/listview/folders/special/all'

// A desktop window of the size one would project into VR.
test.use({ viewport: { width: 1280, height: 800 } })

async function openSettings(page: Page) {
  await page.goto(SETTINGS)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

/**
 * Steps the settings screen's control until it reads `label`. There is no
 * option list to pick from -- see `UiScaleStepper` for why -- so getting to a
 * size means pressing towards it.
 */
async function chooseScale(page: Page, label: string) {
  await stepTowards(page, 'ui-scale-stepper', label)
}

async function stepTowards(page: Page, prefix: string, label: string) {
  const readout = page.getByTestId(prefix)
  const target = Number(label.replace('%', ''))
  for (let press = 0; press < UI_SCALES.length; press++) {
    const current = Number((await readout.innerText()).replace('%', ''))
    if (current === target) {
      return
    }
    await page
      .getByTestId(`${prefix}-${current < target ? 'increase' : 'decrease'}`)
      .click()
  }
  throw new Error(`could not reach ${label} with ${prefix}`)
}

/** The multiplier the controls are drawn at, as the document carries it. */
const controlScale = (page: Page) =>
  page.evaluate(() =>
    document.documentElement.style.getPropertyValue('--control-scale'),
  )

/** How wide the list view's title is actually drawn, in device pixels. */
async function drawnTitleWidth(page: Page) {
  const box = await page
    .getByRole('heading', { name: jaJP['general:all-worlds'] })
    .boundingBox()
  return box!.width
}

const WORLD_ID = 'wrld_ui_scale'
const WORLD_NAME = 'ScaleWorld'

/**
 * How wide a world card is actually drawn, in device pixels: its picture
 * spans the card.
 */
async function drawnCardWidth(page: Page) {
  const box = await page
    .getByRole('img', { name: WORLD_NAME })
    .first()
    .boundingBox()
  return box!.width
}

/**
 * A VR overlay is read at a distance and pointed at with a laser, so what is
 * pressed has to be able to grow: the sidebar, the buttons, the dialogs. The
 * world grid does not -- larger cards would only mean fewer of them -- so the
 * scale is applied to those regions and never to the page as a whole.
 */
test.describe('drawing the controls larger', () => {
  test('starts at full size and leaves the document alone', async ({
    page,
  }) => {
    await openSettings(page)

    await expect(page.getByTestId('ui-scale-stepper')).toHaveText('100%')
    expect(await page.evaluate(() => document.documentElement.style.zoom)).toBe(
      '',
    )
    await expect.poll(() => controlScale(page)).toBe('1')
  })

  test('magnifies the controls, and never zooms the document', async ({
    page,
  }) => {
    await openListView(page)
    const before = await drawnTitleWidth(page)

    await chooseScaleOnList(page, '150%')

    await expect.poll(() => controlScale(page)).toBe('1.5')
    expect(await page.evaluate(() => document.documentElement.style.zoom)).toBe(
      '',
    )
    const after = await drawnTitleWidth(page)
    expect(after).toBeGreaterThan(before * 1.3)
  })

  test('leaves the world grid at the size it was', async ({ page }) => {
    await page.goto(LIST_VIEW)
    await seedWorld(page, { worldId: WORLD_ID, name: WORLD_NAME })
    await openListView(page)
    const before = await drawnCardWidth(page)

    await chooseScaleOnList(page, '200%')

    await expect.poll(() => controlScale(page)).toBe('2')
    expect(await drawnCardWidth(page)).toBeCloseTo(before, 0)
  })

  test('grows the box on each card for selecting it, though not the card', async ({
    page,
  }) => {
    await page.goto(LIST_VIEW)
    await seedWorld(page, { worldId: WORLD_ID, name: WORLD_NAME })
    await openListView(page)
    await page.getByTestId('selection-mode-toggle').click()
    const box = page.getByTestId('world-select-box').first()
    const cardBefore = await drawnCardWidth(page)
    const boxBefore = (await box.boundingBox())!.width

    await chooseScaleOnList(page, '200%')

    await expect.poll(() => controlScale(page)).toBe('2')
    expect(await drawnCardWidth(page)).toBeCloseTo(cardBefore, 0)
    // The box is the one thing on a card that is pressed, so it is drawn at
    // the control scale like the rows and buttons around the grid.
    expect((await box.boundingBox())!.width).toBeCloseTo(boxBefore * 2, 0)
  })

  test('draws the settings screen larger, and its switches larger still', async ({
    page,
  }) => {
    await page.goto('/listview/settings?tab=others')
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })
    const heading = page.getByRole('heading', {
      name: jaJP['general:settings'],
    })
    const toggle = page.getByTestId('skip-self-invite')
    const headingBefore = (await heading.boundingBox())!.width
    const toggleBefore = (await toggle.boundingBox())!.width

    await chooseScale(page, '150%')

    // The screen is a panel -- half the growth -- and the switch in it is a
    // control, drawn at the full 150%.
    await expect
      .poll(async () => (await heading.boundingBox())!.width / headingBefore)
      .toBeCloseTo(1.25, 1)
    expect((await toggle.boundingBox())!.width / toggleBefore).toBeCloseTo(
      1.5,
      1,
    )
  })

  test('reflows rather than spilling off the side of the page', async ({
    page,
  }) => {
    await openListView(page)
    await chooseScaleOnList(page, '200%')

    // The point of `zoom` over `transform: scale()`: a row lays out again at
    // its narrower effective width instead of overflowing it.
    const overflows = await page.evaluate(
      () =>
        document.documentElement.scrollWidth >
        document.documentElement.clientWidth + 1,
    )
    expect(overflows).toBe(false)
  })

  test('has a one-press setting for a headset', async ({ page }) => {
    await openSettings(page)

    await page.getByTestId('ui-scale-vr-preset').click()

    await expect(page.getByTestId('ui-scale-stepper')).toHaveText('150%')
    await expect.poll(() => controlScale(page)).toBe('1.5')
  })

  test('is still in force on the next page, and after a reload', async ({
    page,
  }) => {
    await openSettings(page)
    await chooseScale(page, '125%')

    await page.goto(LIST_VIEW)
    await expect.poll(() => controlScale(page)).toBe('1.25')

    await page.reload()
    await expect.poll(() => controlScale(page)).toBe('1.25')
  })
})

async function openListView(page: Page) {
  await page.goto(LIST_VIEW)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

async function chooseScaleOnList(page: Page, label: string) {
  await stepTowards(page, 'ui-scale-quick', label)
}

/**
 * Scaling up used to be a one-way door: the control that undoes it lived in
 * the settings screen, which is reached through a sidebar that has grown along
 * with everything else. The list view carries the same control so that the way
 * back does not depend on navigating an interface that is too large to
 * navigate.
 */
test.describe('changing the size from the list view', () => {
  test('magnifies the page without a trip to the settings screen', async ({
    page,
  }) => {
    await openListView(page)

    await chooseScaleOnList(page, '150%')

    await expect.poll(() => controlScale(page)).toBe('1.5')
  })

  test('takes the interface back to its original size', async ({ page }) => {
    await openSettings(page)
    await chooseScale(page, '200%')
    await openListView(page)
    await expect(page.getByTestId('ui-scale-quick')).toHaveText('200%')

    await chooseScaleOnList(page, '100%')

    await expect.poll(() => controlScale(page)).toBe('1')
  })

  test('survives a reload, and the settings screen agrees', async ({
    page,
  }) => {
    await openListView(page)
    await chooseScaleOnList(page, '125%')

    await page.reload()
    await expect(page.getByTestId('ui-scale-quick')).toHaveText('125%')

    await openSettings(page)
    await expect(page.getByTestId('ui-scale-stepper')).toHaveText('125%')
  })

  test('keeps both steps inside the viewport at the largest size', async ({
    page,
  }) => {
    // The regression this control exists for: a `Select` here drew its options
    // at twice the offset once the page was zoomed, off the side of the
    // window, so the only way back down was unreachable.
    await openSettings(page)
    await chooseScale(page, '200%')
    await openListView(page)

    const viewport = page.viewportSize()!
    for (const testId of [
      'ui-scale-quick-decrease',
      'ui-scale-quick-increase',
    ]) {
      const box = (await page.getByTestId(testId).boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(0)
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
      expect(box.y).toBeGreaterThanOrEqual(0)
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
    }
  })

  test('keeps the "?" clear of the button it sits beside', async ({ page }) => {
    // The badge is drawn over the bottom-right corner of what it explains, and
    // it used to cover a quarter of the "+". A laser pointed at the button hit
    // the badge instead.
    await openListView(page)

    const plus = (await page
      .getByTestId('ui-scale-quick-increase')
      .boundingBox())!
    const help = (await page.getByTestId('ui-scale-help').boundingBox())!
    const overlap =
      Math.min(plus.x + plus.width, help.x + help.width) -
      Math.max(plus.x, help.x)
    // A hairline of contact is sub-pixel rounding; anything a finger or a
    // laser could land on is not.
    expect(overlap).toBeLessThanOrEqual(2)
  })

  test('says what it scales, behind the "?"', async ({ page }) => {
    await openListView(page)

    await page.getByTestId('ui-scale-help').click()

    await expect(page.getByTestId('ui-scale-explanation')).toContainText(
      jaJP['ui-scale-explanation:revert'],
    )
  })
})
