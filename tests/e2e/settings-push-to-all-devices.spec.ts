import { expect, test, type Page } from '@playwright/test'
import enUS from '../../locales/en-US.json'
import jaJP from '../../locales/ja-JP.json'
import { stubGoogleDrive, type FakeDriveFile } from './stub-google-drive'
import { stubGoogleIdentityServices } from './stub-google-identity'

const SETTINGS = '/listview/settings'

const SYNC_FOLDER = 'VRChat Worlds Manager'
const SYNC_FILE = 'vrcww-sync.json'
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

/** The preferences tab's dropdowns, in the order they appear. */
const LANGUAGE = 1
const CARD_SIZE = 2

/**
 * A snapshot from a device that is not this one, holding a language this one
 * would otherwise never take: `language` is marked "only on this device" by
 * each test before it syncs.
 */
function remoteSnapshot(settingsOverride: unknown): string {
  return JSON.stringify({
    formatVersion: 2,
    metadata: {
      date: '2025-03-01T00:00:00.000Z',
      number_of_folders: 0,
      number_of_worlds: 0,
      app_version: '2.3.0',
    },
    deviceId: 'device-somewhere-else',
    worlds: [],
    folders: [],
    folderOrder: { ids: [], updatedAt: 0, origin: '' },
    hiddenWorlds: [],
    memos: [],
    customTags: [],
    launchedInstances: [],
    // Quoted because that is how the app's own preference writer stores it.
    settings: { language: { value: '"en-US"', updatedAt: 9_999_999_999_999 } },
    settingsOverride,
  })
}

function driveHolding(content: string): FakeDriveFile[] {
  return [
    {
      id: 'folder-1',
      name: SYNC_FOLDER,
      parents: [],
      mimeType: FOLDER_MIME_TYPE,
      version: 1,
      content: '',
    },
    {
      id: 'file-1',
      name: SYNC_FILE,
      parents: ['folder-1'],
      mimeType: 'application/json',
      version: 1,
      content,
    },
  ]
}

async function openPreferences(page: Page) {
  await page.goto(SETTINGS)
  // The dev server floats an overlay over the bottom-left corner, and it
  // swallows clicks meant for the page's own controls.
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await expect(page.locator('button[role="combobox"]').first()).toBeVisible()
}

async function choose(page: Page, dropdown: number, option: number) {
  await page.locator('button[role="combobox"]').nth(dropdown).click()
  await page.getByRole('option').nth(option).click()
}

/**
 * Writes `language` without leaving the interface in another language.
 *
 * Re-picking the value a dropdown already shows changes nothing, so this
 * switches away and back; otherwise the setting is never written and there is
 * no timestamp for a merge to weigh.
 */
async function writeJapaneseLanguage(page: Page) {
  await choose(page, LANGUAGE, 1)
  await choose(page, LANGUAGE, 0)
  await expect(
    page.getByText(jaJP['general:theme-label'], { exact: true }),
  ).toBeVisible()
}

async function keepLanguageToThisDevice(page: Page) {
  await page.locator('#device-only-language').click()
  await expect(page.locator('#device-only-language')).toHaveAttribute(
    'aria-checked',
    'true',
  )
}

async function openSyncTab(page: Page) {
  await page
    .getByRole('tab', { name: jaJP['settings-page:section-sync'] })
    .click()
}

async function connect(page: Page) {
  await openSyncTab(page)
  await page
    .getByRole('button', { name: jaJP['settings-page:google-drive-connect'] })
    .click()
  await expect(
    page.getByRole('button', {
      name: jaJP['settings-page:google-drive-sync-now'],
    }),
  ).toBeVisible()
}

async function syncNow(page: Page) {
  await page
    .getByRole('button', { name: jaJP['settings-page:google-drive-sync-now'] })
    .click()
}

async function pushSettingsToAllDevices(page: Page) {
  await page
    .getByRole('button', { name: jaJP['settings-page:push-settings-button'] })
    .click()
  await page
    .getByRole('button', {
      name: jaJP['settings-page:push-settings-confirm-action'],
    })
    .click()
}

test.describe('pushing this device’s settings to every device', () => {
  test.beforeEach(async ({ page }) => {
    await stubGoogleIdentityServices(page, { token: 'test-access-token' })
  })

  test('sends up even the settings this device keeps to itself', async ({
    page,
  }) => {
    const drive = await stubGoogleDrive(page)

    await openPreferences(page)
    await writeJapaneseLanguage(page)
    // `cardSize` is "only on this device" by default, so an ordinary sync
    // would never publish it at all.
    await choose(page, CARD_SIZE, 0)

    await connect(page)
    await pushSettingsToAllDevices(page)

    await expect(
      page.getByText(jaJP['settings-page:push-settings-success']),
    ).toBeVisible()

    const uploaded = JSON.parse(drive.named(SYNC_FILE)!.content)
    expect(uploaded.settings).toHaveProperty('cardSize')
    expect(uploaded.settings).toHaveProperty('language')
    expect(uploaded.settingsOverride).not.toBeNull()
    expect(uploaded.settingsOverride.at).toBeGreaterThan(0)
  })

  test('leaves the worlds and folders of the file exactly as they were', async ({
    page,
  }) => {
    const drive = await stubGoogleDrive(
      page,
      driveHolding(remoteSnapshot(null)),
    )

    await openPreferences(page)
    await writeJapaneseLanguage(page)

    await connect(page)
    await pushSettingsToAllDevices(page)
    await expect(
      page.getByText(jaJP['settings-page:push-settings-success']),
    ).toBeVisible()

    const uploaded = JSON.parse(drive.named(SYNC_FILE)!.content)
    expect(uploaded.worlds).toEqual([])
    expect(uploaded.folders).toEqual([])
  })
})

test.describe('receiving a demand from another device', () => {
  test.beforeEach(async ({ page }) => {
    await stubGoogleIdentityServices(page, { token: 'test-access-token' })
  })

  test('takes a setting this device had kept to itself, and shows it without a reload', async ({
    page,
  }) => {
    await stubGoogleDrive(
      page,
      driveHolding(
        remoteSnapshot({ origin: 'device-somewhere-else', at: 9_999_999_999 }),
      ),
    )

    await openPreferences(page)
    await writeJapaneseLanguage(page)
    await keepLanguageToThisDevice(page)

    await connect(page)
    await syncNow(page)

    // No reload anywhere in this test: the whole point is that a pulled
    // setting reaches the screen it is on. The sync tab is what is open, so
    // its own button is what has to change language.
    await expect(
      page.getByRole('button', {
        name: enUS['settings-page:google-drive-sync-now'],
      }),
    ).toBeVisible()
  })

  test('honours "only on this device" when no demand was made', async ({
    page,
  }) => {
    await stubGoogleDrive(page, driveHolding(remoteSnapshot(null)))

    await openPreferences(page)
    await writeJapaneseLanguage(page)
    await keepLanguageToThisDevice(page)

    await connect(page)
    await syncNow(page)

    await expect(
      page.getByText(jaJP['settings-page:google-drive-sync-success']),
    ).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: jaJP['settings-page:google-drive-sync-now'],
      }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', {
        name: enUS['settings-page:google-drive-sync-now'],
      }),
    ).toBeHidden()
  })
})
