import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedWorld } from './seed-world'

const RECENTLY_VISITED = '/listview/recently-visited'
const ALL = '/listview/folders/special/all'
const SETTINGS = '/listview/settings?tab=others'

const WORLD_ID = 'wrld_e2e00000-0000-4000-8000-00000000kept'
const WORLD_NAME = 'A World Only Visited'
const INSTANCE_ID = '42424'

// A world someone did add, so a list that has finished loading can be told
// apart from one that has not drawn anything yet.
const ADDED_WORLD_ID = 'wrld_e2e_added'
const ADDED_WORLD_NAME = 'A World Someone Added'

// The worker would otherwise answer the same-origin requests itself, and the
// routes below would never see them.
test.use({ serviceWorkers: 'block' })

/**
 * A world that is only ever seen, never added: it comes back from "recently
 * visited", which is where a world the collection does not hold is opened
 * with `dontSaveToLocal`.
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

async function makeAnInstanceFromARecentlyVisitedWorld(page: Page) {
  await open(page, RECENTLY_VISITED)
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
}

async function turnOn(page: Page, settingTestId: string) {
  await open(page, SETTINGS)
  await page.getByTestId(settingTestId).click()
  await expect(page.getByTestId(settingTestId)).toBeChecked()
}

/** The list has drawn what it holds once the world someone added is there. */
async function expectTheListToHaveLoaded(page: Page) {
  await expect(page.getByText(ADDED_WORLD_NAME).first()).toBeVisible()
}

async function storedWorld(page: Page, worldId: string) {
  return page.evaluate(async (id) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('VRChatWorldsManager')
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    return await new Promise<{ keptForInstance?: boolean } | undefined>(
      (resolve, reject) => {
        const request = db.transaction('worlds').objectStore('worlds').get(id)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      },
    )
  }, worldId)
}

/**
 * An instance outlives the world it was made in.
 *
 * The row that remembers an instance is reached through the world's own detail
 * popup, so a world that is not in the collection has no way back to it. A
 * world opened from the recently visited page is deliberately not saved -- and when its
 * author later makes it private, VRChat stops answering for it, leaving the
 * instance recorded under a world that cannot be found or opened again.
 *
 * So making an instance keeps a copy of the world. But nobody asked for that
 * world, and a list that grows on its own is a list whose meaning changed --
 * so the copy is kept quietly, and shown only when asked for (#173).
 */
test.describe('a world an instance was made in', () => {
  test.beforeEach(async ({ page }) => {
    await stubVRChat(page)
    await open(page, ALL)
    await seedWorld(page, { worldId: ADDED_WORLD_ID, name: ADDED_WORLD_NAME })
  })

  test('is kept, but shown under "all worlds" only when asked for', async ({
    page,
  }) => {
    await makeAnInstanceFromARecentlyVisitedWorld(page)

    // The copy is there, marked as held for the instance alone...
    expect(await storedWorld(page, WORLD_ID)).toMatchObject({
      keptForInstance: true,
    })

    // ...and the list does not show it, because nobody added it.
    await open(page, ALL)
    await expectTheListToHaveLoaded(page)
    await expect(page.getByText(WORLD_NAME)).toBeHidden()

    // Asked for, it appears, wearing the mark that says why it is there.
    await turnOn(page, 'show-worlds-kept-for-instance')
    await open(page, ALL)
    await expect(page.getByText(WORLD_NAME)).toBeVisible()
    await expect(page.getByTestId('kept-for-instance-mark')).toBeVisible()
  })

  test('is not called "added" where it was seen, and is marked there only when asked for', async ({
    page,
  }) => {
    await makeAnInstanceFromARecentlyVisitedWorld(page)

    // The world someone added is not on the recently visited page, so wait for the card
    // itself before reading what is drawn on it.
    await open(page, RECENTLY_VISITED)
    await expect(page.getByText(WORLD_NAME).first()).toBeVisible()
    await expect(
      page.getByText(jaJP['world-grid:exists-in-collection']),
    ).toBeHidden()
    await expect(page.getByTestId('kept-for-instance-mark')).toBeHidden()

    await turnOn(page, 'mark-worlds-kept-for-instance-on-find')
    await open(page, RECENTLY_VISITED)
    await expect(page.getByTestId('kept-for-instance-mark')).toBeVisible()
    await expect(
      page.getByText(jaJP['world-grid:exists-in-collection']),
    ).toBeHidden()
  })

  test('becomes an added world once it is added by hand', async ({ page }) => {
    await makeAnInstanceFromARecentlyVisitedWorld(page)

    await open(page, ALL)
    await page
      .getByRole('button', {
        name: jaJP['listview-page:add-world'],
        exact: true,
      })
      .click()
    await page
      .getByPlaceholder(jaJP['add-world-dialog:placeholder'])
      .fill(WORLD_ID)
    await page
      .getByRole('button', { name: jaJP['add-world-dialog:check'] })
      .click()
    await expect(page.getByText(jaJP['add-world-dialog:preview'])).toBeVisible()
    // Held for an instance is not the same as added, so this is not a
    // duplicate: the button stays pressable, and pressing it is the promotion.
    await page
      .getByRole('button', { name: jaJP['add-world-dialog:add'], exact: true })
      .last()
      .click()
    await expect(page.getByRole('dialog')).toBeHidden()

    // Shown without being asked for, and without the mark: it is added now.
    await open(page, ALL)
    await expect(page.getByText(WORLD_NAME)).toBeVisible()
    await expect(page.getByTestId('kept-for-instance-mark')).toBeHidden()
    expect(await storedWorld(page, WORLD_ID)).not.toHaveProperty(
      'keptForInstance',
    )
  })
})
