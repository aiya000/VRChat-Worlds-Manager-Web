import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const GUIDE = '/migration-guide/v2'
const SETTINGS = '/listview/settings'

async function hideDevOverlay(page: Page) {
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

test('the guide walks through the four steps, with the warning first', async ({
  page,
}) => {
  await page.goto(GUIDE)

  await expect(
    page.getByRole('heading', { name: jaJP['migration-guide:title'] }),
  ).toBeVisible()
  await expect(
    page.getByText(jaJP['migration-guide:caution-title'], { exact: true }),
  ).toBeVisible()

  for (const step of [
    'migration-guide:step1-title',
    'migration-guide:step2-title',
    'migration-guide:step3-title',
    'migration-guide:step4-title',
  ] as const) {
    await expect(page.getByText(jaJP[step])).toBeVisible()
  }
})

// The screenshots are the reason the page exists: a guide whose pictures do not
// load is worse than none, so each one has to be served, and say what it shows.
test('every screenshot is served and described', async ({ page, request }) => {
  await page.goto(GUIDE)

  const images = page.locator('img')
  await expect(images).toHaveCount(3)

  for (const image of await images.all()) {
    const src = await image.getAttribute('src')
    const alt = await image.getAttribute('alt')
    expect(src).toBeTruthy()
    expect(alt).toBeTruthy()

    const response = await request.get(src as string)
    expect(response.status(), `${src} should be served`).toBe(200)
    expect(
      await image.evaluate((el: HTMLImageElement) => el.naturalWidth),
    ).toBeGreaterThan(0)
  }
})

test('the settings card for data migration links to the guide', async ({
  page,
}) => {
  await page.goto(SETTINGS)
  await hideDevOverlay(page)
  await page
    .getByRole('tab', { name: jaJP['settings-page:section-data-management'] })
    .click()

  await expect(
    page.getByRole('link', { name: jaJP['migration-guide:link-label'] }),
  ).toHaveAttribute('href', GUIDE)
})

test('the first-run setup links to the guide once "migrate from the desktop app" is chosen', async ({
  page,
}) => {
  await page.goto('/setup')
  await hideDevOverlay(page)
  await page.getByRole('button', { name: jaJP['setup-layout:start'] }).click()
  await page.getByRole('button', { name: jaJP['general:next'] }).click()
  await page
    .getByRole('button', { name: jaJP['setup-page:restore-source-v2-title'] })
    .click()

  await expect(
    page.getByRole('link', { name: jaJP['migration-guide:link-label'] }),
  ).toHaveAttribute('href', GUIDE)
})

test('the guide fits a narrow panel', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(GUIDE)

  await expect(
    page.getByRole('heading', { name: jaJP['migration-guide:title'] }),
  ).toBeVisible()

  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  )
  expect(overflows).toBe(false)
})
