import { expect, test } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const SETTINGS = '/listview/settings'

// A phone held upright: the width at which four labels stopped fitting.
test.use({ viewport: { width: 390, height: 844 } })

/**
 * The four tabs used to be a four-column grid of no-wrap labels, so at a
 * phone's width "UIのカスタマイズ" and "その他" ran out past the edges of the
 * bar they sit in. Every tab has to stay inside the bar, at any width.
 */
test('every settings tab stays inside the tab bar on a phone', async ({
  page,
}) => {
  await page.goto(SETTINGS)

  const bar = page.getByRole('tablist')
  const barBox = (await bar.boundingBox())!
  const viewport = page.viewportSize()!
  expect(barBox.x).toBeGreaterThanOrEqual(0)
  expect(barBox.x + barBox.width).toBeLessThanOrEqual(viewport.width)

  for (const key of [
    'settings-page:section-preferences',
    'settings-page:section-sync',
    'settings-page:section-data-management',
    'settings-page:section-others',
  ] as const) {
    const tab = page.getByRole('tab', { name: jaJP[key] })
    const box = (await tab.boundingBox())!
    expect(box.x, key).toBeGreaterThanOrEqual(barBox.x)
    expect(box.x + box.width, key).toBeLessThanOrEqual(
      barBox.x + barBox.width + 0.5,
    )
    // Nor may the words spill out of their own tab.
    const overflowing = await tab.evaluate(
      (el) => el.scrollWidth > el.clientWidth + 1,
    )
    expect(overflowing, key).toBe(false)
  }
})
