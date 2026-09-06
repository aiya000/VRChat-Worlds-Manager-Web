import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const SETTINGS = '/listview/settings'

/**
 * The three dropdowns on the preferences tab, in the order they appear. Their
 * labels move with the interface language, which this spec changes on purpose,
 * so position is the stable way to reach them.
 */
const THEME = 0
const LANGUAGE = 1
const CARD_SIZE = 2

async function openPreferences(page: Page) {
  await page.goto(SETTINGS)
  // The dev server floats an overlay over the bottom-left corner and it
  // swallows clicks meant for the page's own controls.
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await expect(page.locator('button[role="combobox"]').nth(THEME)).toBeVisible()
}

async function choose(page: Page, dropdown: number, option: number) {
  await page.locator('button[role="combobox"]').nth(dropdown).click()
  await page.getByRole('option').nth(option).click()
}

/**
 * Gives `language` a stored value and leaves the interface in Japanese.
 *
 * The app already starts in Japanese, and re-picking the value a dropdown is
 * showing changes nothing, so this switches away and back -- otherwise the
 * setting is never written and there is nothing for a backup to carry.
 */
async function chooseLanguage(page: Page) {
  await choose(page, LANGUAGE, 1)
  await choose(page, LANGUAGE, 0)
  await expect(
    page.getByText(jaJP['general:theme-label'], { exact: true }),
  ).toBeVisible()
}

/**
 * Takes a backup through the real button and reads what it actually wrote,
 * which is the only place the classification becomes visible from outside.
 */
async function backedUpSettings(
  page: Page,
): Promise<Record<string, { value: string; updatedAt: number }>> {
  await page
    .getByRole('tab', { name: jaJP['settings-page:section-data-management'] })
    .click()

  const download = page.waitForEvent('download')
  await page
    .getByRole('button', { name: jaJP['settings-page:create-backup'] })
    .click()

  const file = await (await download).path()
  const snapshot = JSON.parse(readFileSync(file, 'utf8')) as {
    settings: Record<string, { value: string; updatedAt: number }>
  }
  return snapshot.settings
}

test.describe('which settings travel with a backup', () => {
  test('starts each setting where it belongs', async ({ page }) => {
    await openPreferences(page)
    await chooseLanguage(page)

    await expect(page.locator('#device-only-language')).toHaveAttribute(
      'aria-checked',
      'false',
    )
    await expect(page.locator('#device-only-cardSize')).toHaveAttribute(
      'aria-checked',
      'true',
    )
  })

  test('carries the ones that follow the person and leaves the ones that belong to the screen', async ({
    page,
  }) => {
    await openPreferences(page)
    await chooseLanguage(page)
    await choose(page, CARD_SIZE, 0)

    const settings = await backedUpSettings(page)

    expect(settings).toHaveProperty('language')
    expect(settings).not.toHaveProperty('cardSize')
  })

  test('stops carrying a setting the moment it is marked as this device only', async ({
    page,
  }) => {
    await openPreferences(page)
    await chooseLanguage(page)

    expect(await backedUpSettings(page)).toHaveProperty('language')

    await page
      .getByRole('tab', { name: jaJP['settings-page:section-preferences'] })
      .click()
    await page.locator('#device-only-language').click()
    await expect(page.locator('#device-only-language')).toHaveAttribute(
      'aria-checked',
      'true',
    )

    expect(await backedUpSettings(page)).not.toHaveProperty('language')
  })

  test('starts carrying a device setting once it is promoted into the sync', async ({
    page,
  }) => {
    await openPreferences(page)
    await chooseLanguage(page)
    await choose(page, CARD_SIZE, 0)

    await page.locator('#device-only-cardSize').click()
    await expect(page.locator('#device-only-cardSize')).toHaveAttribute(
      'aria-checked',
      'false',
    )

    expect(await backedUpSettings(page)).toHaveProperty('cardSize')
  })

  test('never carries anything about being signed in', async ({ page }) => {
    await openPreferences(page)
    await chooseLanguage(page)

    const settings = await backedUpSettings(page)

    expect(settings).not.toHaveProperty('authState')
    expect(settings).not.toHaveProperty('setupComplete')
    expect(settings).not.toHaveProperty('settingUpdatedAt')
    expect(settings).not.toHaveProperty('settingSyncOverrides')
  })
})
