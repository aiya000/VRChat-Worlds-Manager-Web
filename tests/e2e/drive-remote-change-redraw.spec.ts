import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedFolders } from './seed-folders'
import { stubGoogleDrive } from './stub-google-drive'
import { stubGoogleAuth } from './stub-google-auth'

const SETTINGS = '/listview/settings'
const LIST_VIEW = '/listview/folders/special/all'
const SYNC_FILE = 'vrcww-sync.json'
const FOLDER_LIST = '[data-folder-list]'

const LOCAL_FOLDER = 'この端末で作ったフォルダ'
const FOLDER_FROM_ELSEWHERE = 'もう片方の端末で作ったフォルダ'

async function connectAndSync(page: Page) {
  await page.goto(SETTINGS)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page
    .getByRole('tab', { name: jaJP['settings-page:section-sync'] })
    .click()
  await page
    .getByRole('button', { name: jaJP['settings-page:google-drive-connect'] })
    .click()
  await page
    .getByRole('button', { name: jaJP['settings-page:google-drive-sync-now'] })
    .click()
  await expect(
    page.getByText(jaJP['settings-page:google-drive-sync-success']),
  ).toBeVisible()
}

// A desktop, where the sidebar is always on screen and the tab never loses
// focus. That is the shape in which the list has nothing but the sync itself
// to make it read again: on a phone, switching apps and back does it anyway.
test.use({ viewport: { width: 1440, height: 900 } })

test('a folder another device made appears after a press, without a reload', async ({
  page,
}) => {
  await stubGoogleAuth(page, { token: 'test-access-token' })
  const drive = await stubGoogleDrive(page)

  await page.goto(LIST_VIEW)
  await seedFolders(page, [LOCAL_FOLDER])
  await connectAndSync(page)

  // The other device: what this one uploaded, plus one folder.
  const uploaded = JSON.parse(drive.named(SYNC_FILE)!.content)
  const now = Date.now()
  const id = 'folder-made-elsewhere'
  uploaded.folders.push({
    id,
    name: FOLDER_FROM_ELSEWHERE,
    updatedAt: now,
    deletedAt: null,
    origin: 'the-other-device',
  })
  uploaded.folderOrder = {
    ids: [...uploaded.folderOrder.ids, id],
    updatedAt: now,
    origin: 'the-other-device',
  }
  drive.writeFrom(SYNC_FILE, JSON.stringify(uploaded))

  // Back on the list, where the press happens. Nothing has read Drive since
  // the other device wrote, and nothing will until the button is pressed.
  await page.goto(LIST_VIEW)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await expect(
    page.locator(FOLDER_LIST).getByText(LOCAL_FOLDER, { exact: true }),
  ).toBeVisible()
  await expect(
    page.locator(FOLDER_LIST).getByText(FOLDER_FROM_ELSEWHERE, { exact: true }),
  ).toBeHidden()

  await page.getByTestId('drive-sync-button').click()
  // The very first press on this device explains itself before it syncs.
  await page
    .getByRole('button', { name: jaJP['sync-explanation:action-sync'] })
    .click()
  await expect(
    page.getByText(jaJP['settings-page:google-drive-sync-success']),
  ).toBeVisible()

  // The point of the test: on screen, not merely in the database.
  await expect(
    page.locator(FOLDER_LIST).getByText(FOLDER_FROM_ELSEWHERE, { exact: true }),
  ).toBeVisible()
})
