import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const SETTINGS = '/listview/settings'

const SOURCE_ACCOUNT = 'もう一つのアカウント'

/**
 * Playwright's routing only sees what the page itself asks for, and `sw.js`
 * answers same-origin GETs on the page's behalf. Blocking the worker is what
 * makes the request count below mean anything.
 */
test.use({ serviceWorkers: 'block' })

function favoriteWorld(index: number) {
  return {
    id: `wrld_${index}`,
    name: `お気に入り ${index}`,
    authorName: 'Author',
    capacity: 16,
    thumbnailImageUrl: `https://example.invalid/${index}.png`,
    tags: [],
    favorites: index,
    visits: index * 10,
    updated_at: '2025-02-01T00:00:00.000Z',
    unityPackages: [{ platform: 'standalonewindows' }],
  }
}

interface StubbedApi {
  /** Every VRChat API path the page asked for, in order. */
  paths: string[]
  /** Lets the pending favorites page answer. */
  releaseFavorites: () => void
}

/**
 * Answers the Worker proxy with `favoriteCount` favorites, spread over pages of
 * 100 the way VRChat does. The first favorites page is held until
 * `releaseFavorites` is called, so the in-progress screen can be read.
 */
async function stubVRChatApi(
  page: Page,
  favoriteCount: number,
): Promise<StubbedApi> {
  const paths: string[] = []

  let release = () => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })
  let firstFavoritesPage = true

  await page.route('**/api/1/**', async (route) => {
    const url = new URL(route.request().url())
    const path = url.pathname.replace(/^\/api\/1/, '')
    paths.push(path)

    const json = async (body: unknown) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(body),
      })
    }

    if (path === '/logout') {
      await json({ success: true })
      return
    }
    if (path === '/auth/user') {
      await json({ id: 'usr_other', displayName: SOURCE_ACCOUNT })
      return
    }
    if (path === '/worlds/favorites') {
      if (firstFavoritesPage) {
        firstFavoritesPage = false
        await held
      }
      const offset = Number(url.searchParams.get('offset') ?? '0')
      const size = Math.max(0, Math.min(100, favoriteCount - offset))
      await json(
        Array.from({ length: size }, (_, i) => favoriteWorld(offset + i)),
      )
      return
    }

    await route.fulfill({ status: 404, body: 'not stubbed' })
  })

  return { paths, releaseFavorites: () => release() }
}

async function openImportDialog(page: Page) {
  await page.goto(SETTINGS)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page
    .getByRole('tab', { name: jaJP['settings-page:section-data-management'] })
    .click()
  await page
    .getByRole('button', {
      name: jaJP['settings-page:import-favorites-button'],
    })
    .click()
  await page
    .getByRole('button', { name: jaJP['import-favorites:continue-button'] })
    .click()
}

async function signIn(page: Page) {
  await page
    .getByPlaceholder(jaJP['login-page:username-placeholder'])
    .fill('someone')
  await page
    .getByPlaceholder(jaJP['login-page:password-placeholder'])
    .fill('hunter2')
  await page
    .getByRole('button', { name: jaJP['login-page:login-button'] })
    .click()
}

test.describe('reading favorites out of another account', () => {
  test('asks for one page of worlds rather than one request per favorite', async ({
    page,
  }) => {
    const api = await stubVRChatApi(page, 150)

    await openImportDialog(page)
    await signIn(page)
    api.releaseFavorites()

    await expect(
      page.getByText(
        jaJP['import-favorites:select-description'].replace('{0}', '150'),
      ),
    ).toBeVisible()

    // Two pages of 100, and nothing else under `/worlds`. Fetching each
    // favorite on its own is what made this hang: an account with a few
    // hundred favorites runs into the Worker's hourly per-IP limit.
    const worldPaths = api.paths.filter((path) => path.startsWith('/worlds'))
    expect(worldPaths).toEqual(['/worlds/favorites', '/worlds/favorites'])
  })

  test('shows how far along it is, and says not to close the dialog', async ({
    page,
  }) => {
    const api = await stubVRChatApi(page, 10)

    await openImportDialog(page)
    await signIn(page)

    await expect(page.getByText(/^\d+% — /)).toBeVisible()
    await expect(
      page.getByText(jaJP['import-favorites:do-not-close']),
    ).toBeVisible()

    api.releaseFavorites()
    await expect(
      page.getByText(
        jaJP['import-favorites:select-description'].replace('{0}', '10'),
      ),
    ).toBeVisible()
  })

  test('keeps the worlds it read, and signs the other account back out', async ({
    page,
  }) => {
    const api = await stubVRChatApi(page, 3)

    await openImportDialog(page)
    await signIn(page)
    api.releaseFavorites()

    await page
      .getByRole('button', {
        name: jaJP['import-favorites:import-button'].replace('{0}', '3'),
      })
      .click()

    await expect(
      page.getByText(
        jaJP['import-favorites:done-description'].replace('{0}', '3'),
      ),
    ).toBeVisible()

    // Signed out at both ends: once to make room for the other account, and
    // once to leave nobody signed in as somebody else.
    expect(api.paths.filter((path) => path === '/logout')).toHaveLength(2)
  })
})
