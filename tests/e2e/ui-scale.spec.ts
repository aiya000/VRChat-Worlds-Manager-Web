import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

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

async function chooseScale(page: Page, label: string) {
  await page.getByTestId('ui-scale-select').click()
  await page.getByRole('option', { name: label, exact: true }).click()
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

    await expect(page.getByTestId('ui-scale-select')).toHaveText('100%')
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

    await expect(page.getByTestId('ui-scale-select')).toHaveText('150%')
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
