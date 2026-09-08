import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedWorld } from './seed-world'

const LIST_VIEW = '/listview/folders/special/all'
const WORLD_ID = 'wrld_private_badge'
const WORLD_NAME = 'PortalHeaven'

test.use({ serviceWorkers: 'block' })

function worldBody(releaseStatus: string | null) {
  const body: Record<string, unknown> = {
    id: WORLD_ID,
    name: WORLD_NAME,
    authorId: 'usr_e2e',
    authorName: 'someone',
    imageUrl: 'https://example.invalid/image.png',
    thumbnailImageUrl: 'https://example.invalid/thumb.png',
    description: '',
    favorites: 6,
    visits: 282,
    capacity: 32,
    recommendedCapacity: 16,
    updated_at: '2026-01-01T00:00:00.000Z',
    publicationDate: 'none',
    tags: [],
    unityPackages: [{ platform: 'standalonewindows' }],
  }
  if (releaseStatus !== null) {
    body.releaseStatus = releaseStatus
  }
  return JSON.stringify(body)
}

async function answerWith(page: Page, releaseStatus: string | null) {
  await page.route(`**/api/1/worlds/${WORLD_ID}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: worldBody(releaseStatus),
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

/**
 * A world of your own that VRChat is not publishing looks exactly like a
 * public one in here, and the difference decides who can follow a link to it.
 * VRChat says which in `releaseStatus`, which this app used to drop on the way
 * in.
 */
test.describe('a world VRChat is not publishing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIST_VIEW)
    await seedWorld(page, { worldId: WORLD_ID, name: WORLD_NAME })
  })

  test('is marked as private in the world detail', async ({ page }) => {
    await answerWith(page, 'private')
    await openTheWorld(page)

    const badge = page.getByTestId('world-private-badge')
    await expect(badge).toBeVisible()
    await expect(badge).toHaveText(jaJP['world-detail:private-world'])
  })

  test('is not marked when VRChat says the world is public', async ({
    page,
  }) => {
    await answerWith(page, 'public')
    await openTheWorld(page)

    await expect(page.getByRole('dialog')).toContainText(WORLD_NAME)
    await expect(page.getByTestId('world-private-badge')).toBeHidden()
  })

  test('is not marked when VRChat said nothing about it', async ({ page }) => {
    // Not knowing is not the same as being public, and it is not the same as
    // being private either -- a guess would be read as a fact.
    await answerWith(page, null)
    await openTheWorld(page)

    await expect(page.getByRole('dialog')).toContainText(WORLD_NAME)
    await expect(page.getByTestId('world-private-badge')).toBeHidden()
  })
})
