import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const LIST_VIEW = '/listview/folders/special/all'
const WORLD_ID = 'wrld_99999999-8888-7777-6666-555555555555'
const WORLD_NAME = 'A World With Numbers'
const AUTHOR = 'someone-who-made-it'

test.use({ serviceWorkers: 'block' })

async function describeTheWorld(page: Page) {
  await page.route(`**/api/1/worlds/${WORLD_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: WORLD_ID,
        name: WORLD_NAME,
        authorId: 'usr_e2e',
        authorName: AUTHOR,
        imageUrl: 'https://example.invalid/image.png',
        thumbnailImageUrl: 'https://example.invalid/thumb.png',
        description: '',
        favorites: 4242,
        visits: 31337,
        capacity: 32,
        recommendedCapacity: 16,
        updated_at: '2026-01-01T00:00:00.000Z',
        publicationDate: 'none',
        releaseStatus: 'public',
        tags: [],
        unityPackages: [{ platform: 'standalonewindows' }],
      }),
    })
  })
}

/** Turns off exactly what the reader turned off: author, visits, favourites. */
async function hideTheNumbers(page: Page) {
  await page.goto(LIST_VIEW)
  await page.evaluate(() => {
    localStorage.setItem(
      'worldCardFieldVisibility',
      JSON.stringify({
        name: true,
        authorName: false,
        visits: false,
        lastUpdated: true,
        favorites: false,
      }),
    )
    localStorage.setItem(
      'worldDetailFieldVisibility',
      JSON.stringify({
        visits: false,
        favorites: false,
        capacity: true,
        published: true,
        lastUpdated: true,
      }),
    )
  })
}

async function previewTheWorld(page: Page) {
  await page.goto(LIST_VIEW)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page
    .getByRole('button', { name: jaJP['listview-page:add-world'], exact: true })
    .click()
  await page
    .getByPlaceholder(jaJP['add-world-dialog:placeholder'])
    .fill(WORLD_ID)
  await page
    .getByRole('button', { name: jaJP['add-world-dialog:check'] })
    .click()
  await expect(page.getByText(jaJP['add-world-dialog:preview'])).toBeVisible()
}

/**
 * The preview is a promise about the list and the world detail, so it has to
 * keep the same one: a field turned off in the settings does not come back
 * here. It used to show every field regardless, which is how a reader who had
 * hidden the numbers met them again on the way in.
 */
test.describe('the add-world preview and the fields that were hidden', () => {
  test('leaves out the author, the visits and the favourites', async ({
    page,
  }) => {
    await describeTheWorld(page)
    await hideTheNumbers(page)
    await previewTheWorld(page)

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(WORLD_NAME)
    await expect(dialog).not.toContainText(AUTHOR)
    await expect(dialog).not.toContainText('31337')
    await expect(dialog).not.toContainText('4242')
    // What was left on is still there.
    await expect(dialog).toContainText(jaJP['world-detail:capacity'])
  })

  test('shows them again while the checkbox is ticked, and hides them once it is not', async ({
    page,
  }) => {
    await describeTheWorld(page)
    await hideTheNumbers(page)
    await previewTheWorld(page)

    await page.getByTestId('show-hidden-fields').click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(AUTHOR)
    await expect(dialog).toContainText('31337')
    await expect(dialog).toContainText('4242')

    await page.getByTestId('show-hidden-fields').click()
    await expect(dialog).not.toContainText(AUTHOR)
  })

  test('offers no checkbox when nothing is hidden', async ({ page }) => {
    await describeTheWorld(page)
    await previewTheWorld(page)

    await expect(page.getByRole('dialog')).toContainText(AUTHOR)
    await expect(page.getByTestId('show-hidden-fields')).toBeHidden()
  })
})
