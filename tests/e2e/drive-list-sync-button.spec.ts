import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedFolders } from './seed-folders'
import { stubGoogleDrive, type FakeDriveFile } from './stub-google-drive'
import { stubGoogleAuth } from './stub-google-auth'

const SETTINGS = '/listview/settings'
const LIST_VIEW = '/listview/folders/special/all'

const SYNC_FOLDER = 'VRChat Worlds Manager'
const SYNC_FILE = 'vrcww-sync.json'

const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder'

const REMOTE_ONLY_FOLDER = 'Driveにだけあるフォルダ'
const LOCAL_ONLY_FOLDER = 'この端末で作ったフォルダ'
const MADE_AFTER_SYNCING = 'あとから作ったフォルダ'

/** A file in the shape releases before sync wrote: no timestamps anywhere. */
const REMOTE_SNAPSHOT = {
  metadata: {
    date: '2025-03-01T00:00:00.000Z',
    number_of_folders: 1,
    number_of_worlds: 0,
    app_version: '2.0.0',
  },
  worlds: [],
  folders: [{ name: REMOTE_ONLY_FOLDER, world_count: 0 }],
  hiddenWorlds: [],
  memos: {},
  customTags: {},
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

async function hideDevOverlay(page: Page) {
  // The dev server's error overlay sits above everything and swallows clicks
  // meant for what is underneath it.
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

async function connect(page: Page) {
  await page.goto(SETTINGS)
  await hideDevOverlay(page)
  await page
    .getByRole('tab', { name: jaJP['settings-page:section-sync'] })
    .click()
  await page
    .getByRole('button', { name: jaJP['settings-page:google-drive-connect'] })
    .click()
  await expect(
    page.getByRole('button', {
      name: jaJP['settings-page:google-drive-sync-now'],
    }),
  ).toBeVisible()
}

async function openTheList(page: Page) {
  await page.goto(LIST_VIEW)
  await hideDevOverlay(page)
}

const syncButton = (page: Page) => page.getByTestId('drive-sync-button')
const explanation = (page: Page) => page.getByTestId('sync-explanation')
const proceed = (page: Page) =>
  page.getByRole('button', { name: jaJP['sync-explanation:action-sync'] })
const dontShowAgain = (page: Page) =>
  page.getByLabel(jaJP['explanation:dont-show-again'])
const successToast = (page: Page) =>
  page.getByText(jaJP['settings-page:google-drive-sync-success'])

async function createFolder(page: Page, name: string) {
  await page.locator('[data-sidebar="trigger"]').click()
  const drawer = page.getByRole('dialog')
  await expect(drawer).toBeVisible()
  await drawer
    .getByText(jaJP['app-sidebar:add-folder'], { exact: true })
    .click()
  await page
    .getByPlaceholder(jaJP['create-folder-dialog:placeholder'])
    .fill(name)
  await page
    .getByRole('button', { name: jaJP['create-folder-dialog:create'] })
    .click()
  await expect(
    page.getByText(jaJP['create-folder-dialog:create-title']),
  ).toBeHidden()
}

// A phone: the button has to work where the words beside it are hidden, and
// the sidebar opens as a drawer, which is what `createFolder` clicks through.
const PHONE = { width: 390, height: 844 }

test.describe('the sync button on the list', () => {
  test.use({ viewport: PHONE })

  test.beforeEach(async ({ page }) => {
    await stubGoogleAuth(page, { token: 'test-access-token' })
  })

  test('leads to the settings when this device is not connected', async ({
    page,
  }) => {
    await stubGoogleDrive(page)
    await openTheList(page)

    await syncButton(page).click()

    // Not a sync and not a silent nothing: it says what syncing is, and
    // where connecting happens.
    await expect(explanation(page)).toBeVisible()
    await page
      .getByRole('button', { name: jaJP['sync-explanation:action-connect'] })
      .click()

    await expect(page).toHaveURL(/\/listview\/settings\/?\?tab=sync$/)
    await expect(
      page.getByRole('button', {
        name: jaJP['settings-page:google-drive-connect'],
      }),
    ).toBeVisible()
  })

  test('explains itself before each press, until told not to', async ({
    page,
  }) => {
    await stubGoogleDrive(page, driveHolding(JSON.stringify(REMOTE_SNAPSHOT)))
    await openTheList(page)
    await seedFolders(page, [LOCAL_ONLY_FOLDER])
    await connect(page)
    await openTheList(page)

    await syncButton(page).click()
    await expect(explanation(page)).toBeVisible()
    await proceed(page).click()
    await expect(successToast(page)).toBeVisible()
    await expect(explanation(page)).toBeHidden()

    // Going on without ticking the box is not the same as having read it:
    // it comes back on the next press.
    await successToast(page).waitFor({ state: 'hidden' })
    await syncButton(page).click()
    await expect(explanation(page)).toBeVisible()
    await dontShowAgain(page).click()
    await proceed(page).click()
    await expect(successToast(page)).toBeVisible()

    // Now it stays out of the way: the next press just syncs.
    await successToast(page).waitFor({ state: 'hidden' })
    await syncButton(page).click()
    await expect(explanation(page)).toBeHidden()
    await expect(successToast(page)).toBeVisible()
  })

  test('counts how far along it is while it works', async ({ page }) => {
    await stubGoogleDrive(page, driveHolding(JSON.stringify(REMOTE_SNAPSHOT)))
    // Registered after the Drive stub, so it wins: every call is slowed to
    // what a sync feels like on a bad connection, which is the case the
    // count exists for and the only way to read a step before it is gone.
    await page.route('https://www.googleapis.com/**', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 400))
      await route.fallback()
    })
    await openTheList(page)
    await connect(page)
    await openTheList(page)

    await syncButton(page).click()
    await dontShowAgain(page).click()
    await proceed(page).click()

    // The word the button carries gives way to the count, and only to the
    // count: the row has no width to spare for the step's own sentence at
    // 200% on a phone.
    await expect(page.getByTestId('drive-sync-progress')).toHaveText(/^\d+%$/)
    // The sentence is not lost -- it is in the name the button answers to,
    // where there is room for it.
    await expect(syncButton(page)).toHaveAttribute('aria-label', /^\d+% — .+/)

    await expect(successToast(page)).toBeVisible()
    // ...and the word comes back once it is done.
    await expect(page.getByTestId('drive-sync-progress')).toHaveText(
      jaJP['list-view:sync'],
    )
  })

  test('the "?" shows the explanation on demand, without the checkbox', async ({
    page,
  }) => {
    await stubGoogleDrive(page)
    await openTheList(page)

    await page.getByTestId('drive-sync-help').click()
    await expect(explanation(page)).toBeVisible()
    await expect(dontShowAgain(page)).toBeHidden()
    await expect(proceed(page)).toBeHidden()
    await page.getByRole('button', { name: jaJP['general:close'] }).click()
    await expect(explanation(page)).toBeHidden()
  })

  test('marks a change waiting to be sent, and clears the mark once it went', async ({
    page,
  }) => {
    const drive = await stubGoogleDrive(
      page,
      driveHolding(JSON.stringify(REMOTE_SNAPSHOT)),
    )
    await openTheList(page)
    await seedFolders(page, [LOCAL_ONLY_FOLDER])
    await connect(page)
    await openTheList(page)

    // A first sync, so there is a "last synced" for a change to be newer than.
    await syncButton(page).click()
    await dontShowAgain(page).click()
    await proceed(page).click()
    await expect(
      page.getByText(jaJP['settings-page:google-drive-sync-success']),
    ).toBeVisible()
    await expect(syncButton(page)).not.toHaveAttribute('data-unsynced', 'true')

    // Through the interface, not straight into IndexedDB: what marks the
    // button is Dexie telling the app a row changed, and a raw IndexedDB
    // write goes round the back of that.
    await createFolder(page, MADE_AFTER_SYNCING)
    await expect(syncButton(page)).toHaveAttribute('data-unsynced', 'true')

    // The drawer the folder was made from is still open, over the button.
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog')).toBeHidden()
    await page
      .getByText(jaJP['settings-page:google-drive-sync-success'])
      .waitFor({ state: 'hidden' })
    await syncButton(page).click()
    await expect(
      page.getByText(jaJP['settings-page:google-drive-sync-success']),
    ).toBeVisible()
    await expect(syncButton(page)).not.toHaveAttribute('data-unsynced', 'true')

    const uploaded = JSON.parse(drive.named(SYNC_FILE)!.content)
    expect(
      (uploaded.folders as { name: string }[]).map((f) => f.name).sort(),
    ).toEqual(
      [REMOTE_ONLY_FOLDER, LOCAL_ONLY_FOLDER, MADE_AFTER_SYNCING].sort(),
    )
  })
})

// Just wide enough for "add" and "fetch" to share the first line, and not
// wide enough for "sync" to join them: the shape in the phone screenshot
// where the wrapped button used to start a new left margin of its own.
test.describe('when the header actions wrap', () => {
  test.use({ viewport: { width: 500, height: 932 } })

  test('the sync button lines up under the right edge of the fetch button', async ({
    page,
  }) => {
    await stubGoogleAuth(page, { token: 'test-access-token' })
    await stubGoogleDrive(page)
    await openTheList(page)

    // The sync button appears once the connection state has been read, and
    // the row settles only then; measure nothing before it is there.
    await expect(syncButton(page)).toBeVisible()
    const fetch = page.getByRole('button', {
      name: jaJP['fetch-favorites:button'],
      exact: true,
    })
    const fetchBox = (await fetch.boundingBox())!
    const syncBox = (await syncButton(page).boundingBox())!
    expect(syncBox.y).toBeGreaterThan(fetchBox.y + fetchBox.height - 1)
    // The scale control follows the sync button, so it is the one that ends
    // the wrapped line; what is being checked is that the line ends where the
    // one above it does rather than starting a left margin of its own.
    const scaleBox = (await page.getByTestId('ui-scale-quick').boundingBox())!
    expect(scaleBox.y).toBe(syncBox.y)
    expect(
      Math.abs(scaleBox.x + scaleBox.width - (fetchBox.x + fetchBox.width)),
    ).toBeLessThanOrEqual(1)
    // ...and both are the same height, or they would sit visibly lower on the
    // widths where they share a line with it.
    expect(syncBox.height).toBe(fetchBox.height)
    expect(scaleBox.height).toBe(fetchBox.height)
  })
})
