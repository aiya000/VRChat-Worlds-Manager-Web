import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const FIND = '/listview/folders/special/find'
const ALL = '/listview/folders/special/all'

const WORLD_ID = 'wrld_e2e_kept'
const WORLD_NAME = 'A World Only Visited'
const INSTANCE_ID = '42424'

// The worker would otherwise answer the same-origin requests itself, and the
// routes below would never see them.
test.use({ serviceWorkers: 'block' })

/**
 * A world that is only ever seen, never added: it comes back from "recently
 * visited" on the find page, which is where a world the collection does not
 * hold is opened with `dontSaveToLocal`.
 */
async function stubVRChat(page: Page) {
  await page.route('**/api/1/worlds/recent**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: WORLD_ID,
          name: WORLD_NAME,
          authorName: 'someone',
          imageUrl: 'https://example.invalid/thumbnail.png',
          unityPackages: [{ platform: 'standalonewindows' }],
        },
      ]),
    })
  })

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
        favorites: 3,
        visits: 9,
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

  await page.route('**/api/1/auth/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'usr_e2e', displayName: 'someone' }),
    })
  })

  await page.route('**/api/1/instances**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: `${WORLD_ID}:${INSTANCE_ID}`,
        worldId: WORLD_ID,
        instanceId: INSTANCE_ID,
        shortName: null,
      }),
    })
  })

  await page.route('**/api/1/invite/myself/to/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    })
  })
}

async function open(page: Page, path: string) {
  await page.goto(path)
  // The dev server's error overlay sits above everything and swallows clicks.
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

/**
 * An instance outlives the world it was made in.
 *
 * The row that remembers an instance is reached through the world's own detail
 * popup, so a world that is not in the collection has no way back to it. A
 * world opened from "find" is deliberately not saved -- and when its author
 * later makes it private, VRChat stops answering for it, leaving the instance
 * recorded under a world that cannot be found or opened again.
 *
 * So making an instance keeps a copy of the world.
 */
test.describe('a world an instance was made in', () => {
  test('is kept, even though it was only ever seen on the find page', async ({
    page,
  }) => {
    await stubVRChat(page)

    // Nothing in the collection to begin with.
    await open(page, ALL)
    await expect(page.getByText(WORLD_NAME)).toBeHidden()

    await open(page, FIND)
    await page.getByText(WORLD_NAME).first().click()
    await page
      .getByRole('button', {
        name: jaJP['general:create-instance'],
        exact: true,
      })
      .click()

    // The instance was made and remembered.
    await expect(
      page.getByText(jaJP['world-detail:saved-instances'], { exact: true }),
    ).toBeVisible()

    // ...and so was the world it was made in, which is the only route back to
    // that instance once VRChat stops serving the world.
    await open(page, ALL)
    await expect(page.getByText(WORLD_NAME)).toBeVisible()
  })
})
