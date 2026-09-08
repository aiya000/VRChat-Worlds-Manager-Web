import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedWorld } from './seed-world'

const LIST_VIEW = '/listview/folders/special/all'
const SETTINGS = '/listview/settings?tab=others'
const WORLD_ID = 'wrld_self_invite'
const WORLD_NAME = 'InviteWorld'
const INSTANCE_ID = '77777'

test.use({ serviceWorkers: 'block' })

/**
 * Answers the instance VRChat would have made, and records every self-invite
 * the app asks for.
 */
async function stubVRChat(page: Page) {
  const invites: string[] = []

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

  await page.route('**/api/1/auth/user', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 'usr_e2e', displayName: 'someone' }),
    })
  })

  // VRChat answers in its own spelling; `parseInstanceInfo` reads these two.
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
    invites.push(new URL(route.request().url()).pathname)
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    })
  })

  return invites
}

async function makeAnInstance(page: Page) {
  await page.goto(LIST_VIEW)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page.getByText(WORLD_NAME).first().click()
  await page
    .getByRole('button', { name: jaJP['general:create-instance'], exact: true })
    .click()
}

/**
 * Making an instance sends the invite that gets you into it.
 *
 * VRChat's own website does; this app only ever sent one from the "open in
 * VRChat" button, and only on Android -- so an instance made here looked
 * created and could not be reached from the app (#115).
 */
test.describe('the invite that comes with a new instance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIST_VIEW)
    await seedWorld(page, { worldId: WORLD_ID, name: WORLD_NAME })
  })

  test('goes out for the instance that was just made', async ({ page }) => {
    const invites = await stubVRChat(page)
    await makeAnInstance(page)

    await expect(
      page.getByText(jaJP['world-detail:android-invite-sent']),
    ).toBeVisible()
    expect(invites).toEqual([
      `/api/1/invite/myself/to/${WORLD_ID}:${INSTANCE_ID}`,
    ])
  })

  test('is not sent once that is turned off in the settings', async ({
    page,
  }) => {
    await page.goto(SETTINGS)
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })
    await page.getByTestId('skip-self-invite').click()
    await expect(page.getByTestId('skip-self-invite')).toBeChecked()

    const invites = await stubVRChat(page)
    await makeAnInstance(page)

    // The instance is still made, and still remembered; only the notification
    // is left out.
    await expect(
      page.getByText(jaJP['world-detail:saved-instances'], { exact: true }),
    ).toBeVisible()
    expect(invites).toEqual([])
  })
})
