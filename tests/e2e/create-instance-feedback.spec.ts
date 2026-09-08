import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedWorld } from './seed-world'

const LIST_VIEW = '/listview/folders/special/all'
const WORLD_ID = 'wrld_create_feedback'
const WORLD_NAME = 'FeedbackWorld'
const INSTANCE_ID = '88888'

const ANDROID_CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36'

test.use({ serviceWorkers: 'block' })

/**
 * Answers as VRChat would, with the instance held back for `instanceDelayMs`
 * so there is a moment in which the button has been pressed and nothing has
 * come back yet.
 */
async function stubVRChat(page: Page, instanceDelayMs: number) {
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
        unityPackages: [
          { platform: 'standalonewindows' },
          { platform: 'android' },
        ],
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
    await new Promise((resolve) => setTimeout(resolve, instanceDelayMs))
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

async function openTheWorld(page: Page) {
  await page.goto(LIST_VIEW)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page.getByText(WORLD_NAME).first().click()
}

const createButton = (page: Page) => page.getByTestId('create-instance')
// Sonner draws each toast as a list item inside its notifications region.
const successToast = (page: Page) =>
  page
    .getByRole('region', { name: /Notifications/ })
    .getByRole('listitem')
    .filter({ hasText: jaJP['general:success-title'] })

test.describe('pressing "create instance"', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIST_VIEW)
    await seedWorld(page, { worldId: WORLD_ID, name: WORLD_NAME })
  })

  /**
   * VRChat takes a few seconds to make an instance, and the button used to sit
   * there as if nothing had been pressed.
   */
  test('says it is working until VRChat answers', async ({ page }) => {
    await stubVRChat(page, 1500)
    await openTheWorld(page)

    await createButton(page).click()

    await expect(createButton(page)).toBeDisabled()
    await expect(createButton(page)).toContainText(
      jaJP['listview-page:creating-instance'],
    )

    await expect(successToast(page)).toBeVisible()
    await expect(createButton(page)).toBeEnabled()
    await expect(createButton(page)).toContainText(
      jaJP['general:create-instance'],
    )
  })

  test('offers to open the instance on a desktop', async ({ page }) => {
    await stubVRChat(page, 0)
    await openTheWorld(page)

    await createButton(page).click()

    await expect(
      successToast(page).getByRole('button', {
        name: jaJP['listview-page:open-in-client'],
      }),
    ).toBeVisible()
  })
})

/**
 * No link opens the Android app, into an instance or at all (#150), so the
 * button would only promise what the phone cannot do. The invite the toast
 * reports is the way in.
 */
test.describe('pressing "create instance" on an Android phone', () => {
  test.use({ userAgent: ANDROID_CHROME })

  test.beforeEach(async ({ page }) => {
    await page.goto(LIST_VIEW)
    await seedWorld(page, { worldId: WORLD_ID, name: WORLD_NAME })
  })

  test('does not offer to open the instance', async ({ page }) => {
    await stubVRChat(page, 0)
    await openTheWorld(page)

    await createButton(page).click()

    const toast = successToast(page)
    await expect(toast).toBeVisible()
    await expect(
      toast.getByText(jaJP['world-detail:android-invite-sent']),
    ).toBeVisible()
    await expect(
      toast.getByRole('button', {
        name: jaJP['listview-page:open-in-client'],
      }),
    ).toHaveCount(0)
  })
})
