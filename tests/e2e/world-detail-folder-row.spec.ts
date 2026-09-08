import { expect, test, type Page } from '@playwright/test'
import { seedFolders } from './seed-folders'
import { seedWorld } from './seed-world'

const LIST_VIEW = '/listview/folders/special/all'
const WORLD_ID = 'wrld_folder_row'
const WORLD_NAME = 'FolderRowWorld'

test.use({ serviceWorkers: 'block' })

async function stubVRChat(page: Page) {
  await page.route(`**/api/1/worlds/${WORLD_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: WORLD_ID,
        name: WORLD_NAME,
        authorId: 'usr_e2e',
        authorName: 'someone',
        imageUrl: 'https://example.invalid/image.png',
        thumbnailImageUrl: 'https://example.invalid/thumb.png',
        description: '',
        favorites: 1,
        visits: 1,
        capacity: 32,
        recommendedCapacity: 16,
        updated_at: '2026-01-01T00:00:00.000Z',
        publicationDate: '2026-01-01T00:00:00.000Z',
        releaseStatus: 'public',
        tags: [],
        unityPackages: [{ platform: 'standalonewindows' }],
      }),
    })
  })
}

/**
 * The folder rows in the world detail used to toggle only on the box itself,
 * a target a VR laser rarely lands on; pressing the name selected the text.
 */
test('the world detail puts a world in a folder when its name is pressed', async ({
  page,
}) => {
  await page.goto(LIST_VIEW)
  await seedWorld(page, { worldId: WORLD_ID, name: WORLD_NAME })
  await seedFolders(page, ['Alpha', 'Beta'])
  await stubVRChat(page)

  await page.goto(LIST_VIEW)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page.getByText(WORLD_NAME).first().click()
  const dialog = page.getByRole('dialog')
  // The second row; the box carried no name of its own before the fix.
  const beta = dialog.getByRole('checkbox').nth(1)
  await expect(beta).not.toBeChecked()

  await dialog.getByText('Beta', { exact: true }).click()

  await expect(beta).toBeChecked()
})
