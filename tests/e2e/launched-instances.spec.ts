import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedWorldWithInstances, WORLD_ID } from './seed-launched-instances'

const LIST_VIEW = '/listview/folders/special/all'
const SETTINGS = '/listview/settings'

/**
 * The saved instances, addressed as their own group: the instance-type buttons
 * higher up the same popup carry the very same words.
 */
function savedInstances(page: Page) {
  return page.getByRole('group', {
    name: jaJP['world-detail:saved-instances'],
  })
}

async function openTheWorld(page: Page) {
  await page.goto(LIST_VIEW)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page.getByText('Launched World').first().click()
  await expect(
    page.getByText(jaJP['world-detail:saved-instances'], { exact: true }),
  ).toBeVisible()
}

test.describe('instances kept so a world can be entered again', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIST_VIEW)
    await seedWorldWithInstances(page)
  })

  test('lists them with the most recent first', async ({ page }) => {
    await openTheWorld(page)

    const rows = savedInstances(page).locator('button', { hasText: '·' })
    // Ordered by when they were made, and spelled the way the buttons that
    // pick an instance type spell it.
    await expect(rows.first()).toContainText(jaJP['world-detail:friends'])
    await expect(rows.first()).toContainText('USE')
    await expect(rows.nth(1)).toContainText(jaJP['world-detail:public'])
    await expect(rows.nth(1)).toContainText('JP')
  })

  test('hands the client a launch URL built from the ids alone', async ({
    page,
  }) => {
    await openTheWorld(page)

    // The client is opened through a `vrchat://` URL, which the browser under
    // test cannot follow, so watch for the window being opened instead.
    const opened = page.evaluate(
      () =>
        new Promise<string>((resolve) => {
          window.open = (url) => {
            resolve(String(url))
            return null
          }
        }),
    )

    await savedInstances(page)
      .locator('button', { hasText: jaJP['world-detail:friends'] })
      .first()
      .click()

    expect(await opened).toBe(
      `vrchat://launch?ref=vrchat.com&id=${WORLD_ID}:22222`,
    )
  })

  test('forgets one when asked, and keeps the other', async ({ page }) => {
    await openTheWorld(page)

    await savedInstances(page)
      .getByRole('button', { name: jaJP['world-detail:forget-instance'] })
      .first()
      .click()

    await expect(
      savedInstances(page).locator('button', {
        hasText: jaJP['world-detail:friends'],
      }),
    ).toHaveCount(0)
    await expect(
      savedInstances(page).locator('button', {
        hasText: jaJP['world-detail:public'],
      }),
    ).toBeVisible()
  })

  test('travels with a backup, so the other device can enter the world too', async ({
    page,
  }) => {
    await page.goto(SETTINGS)
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })
    await page
      .getByRole('tab', { name: jaJP['settings-page:section-data-management'] })
      .click()

    const download = page.waitForEvent('download')
    await page
      .getByRole('button', { name: jaJP['settings-page:create-backup'] })
      .click()

    const snapshot = JSON.parse(
      readFileSync(await (await download).path(), 'utf8'),
    ) as { launchedInstances: { id: string }[] }

    expect(snapshot.launchedInstances.map((row) => row.id).sort()).toEqual([
      `${WORLD_ID}:11111`,
      `${WORLD_ID}:22222`,
    ])
  })
})
