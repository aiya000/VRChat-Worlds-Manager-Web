import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { UI_SCALES } from '../../src/lib/ui-scale'

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

/** How wide the settings heading is actually drawn, in device pixels. */
async function drawnHeadingWidth(page: Page) {
  const box = await page
    .getByRole('heading', { name: jaJP['general:settings'] })
    .boundingBox()
  return box!.width
}

/**
 * A VR overlay is read at a distance and pointed at with a laser, so the whole
 * interface has to be able to grow. It grows by `zoom`, which reflows the page
 * into its narrower self rather than pushing it off the edge -- so what
 * appears at a larger size is the layout this app already has for narrow
 * screens, not a second one built for VR.
 */
test.describe('drawing the interface larger', () => {
  test('starts at full size and leaves the document alone', async ({
    page,
  }) => {
    await openSettings(page)

    await expect(page.getByTestId('ui-scale-stepper')).toHaveText('100%')
    expect(await page.evaluate(() => document.documentElement.style.zoom)).toBe(
      '',
    )
  })

  test('magnifies what is on screen when a larger size is chosen', async ({
    page,
  }) => {
    await openSettings(page)
    const before = await drawnHeadingWidth(page)

    await chooseScale(page, '150%')

    expect(await page.evaluate(() => document.documentElement.style.zoom)).toBe(
      '150%',
    )
    const after = await drawnHeadingWidth(page)
    expect(after).toBeGreaterThan(before * 1.3)
  })

  test('reflows rather than spilling off the side of the page', async ({
    page,
  }) => {
    await openSettings(page)
    await chooseScale(page, '200%')

    // The point of `zoom` over `transform: scale()`: the page lays out again
    // at the narrower effective width instead of overflowing it.
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
    expect(await page.evaluate(() => document.documentElement.style.zoom)).toBe(
      '150%',
    )
  })

  test('is still in force on the next page, and after a reload', async ({
    page,
  }) => {
    await openSettings(page)
    await chooseScale(page, '125%')

    await page.goto(LIST_VIEW)
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.zoom))
      .toBe('125%')

    await page.reload()
    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.zoom))
      .toBe('125%')
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

    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.zoom))
      .toBe('150%')
  })

  test('takes the interface back to its original size', async ({ page }) => {
    await openSettings(page)
    await chooseScale(page, '200%')
    await openListView(page)
    await expect(page.getByTestId('ui-scale-quick')).toHaveText('200%')

    await chooseScaleOnList(page, '100%')

    await expect
      .poll(() => page.evaluate(() => document.documentElement.style.zoom))
      .toBe('')
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

  test('says what it scales, behind the "?"', async ({ page }) => {
    await openListView(page)

    await page.getByTestId('ui-scale-help').click()

    await expect(page.getByTestId('ui-scale-explanation')).toContainText(
      jaJP['ui-scale-explanation:revert'],
    )
  })
})
