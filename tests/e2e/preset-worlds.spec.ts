import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { PRESET_WORLD_IDS } from '../../src/lib/preset-worlds'
import { stubGoogleAuth } from './stub-google-auth'
import { stubGoogleDrive } from './stub-google-drive'

const LIST_VIEW = '/listview/folders/special/all'

// The worker would otherwise answer the same-origin requests itself, and the
// routes below would never see them.
test.use({ serviceWorkers: 'block' })

/** The name a preset world is given here, by its place in the list. */
const nameOfPreset = (index: number) => `Preset World ${index + 1}`

/**
 * Answers for every preset world, and for nothing else.
 *
 * `failing` names the ones VRChat refuses, which is how the "all or nothing"
 * rule is exercised without waiting for a real outage.
 */
async function describeThePresets(
  page: Page,
  options: { failing?: string[]; delayMs?: number; asked?: string[] } = {},
) {
  const { failing = [], delayMs = 0, asked } = options
  for (const [index, worldId] of PRESET_WORLD_IDS.entries()) {
    await page.route(`**/api/1/worlds/${worldId}`, async (route) => {
      asked?.push(worldId)
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
      if (failing.includes(worldId)) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: { message: 'not found' } }),
        })
        return
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: worldId,
          name: nameOfPreset(index),
          authorId: 'usr_e2e',
          authorName: 'someone',
          imageUrl: 'https://example.invalid/image.png',
          thumbnailImageUrl: 'https://example.invalid/thumb.png',
          description: '',
          favorites: 1,
          visits: 2,
          capacity: 16,
          recommendedCapacity: 8,
          updated_at: '2026-01-01T00:00:00.000Z',
          publicationDate: 'none',
          releaseStatus: 'public',
          tags: [],
          unityPackages: [{ platform: 'standalonewindows' }],
        }),
      })
    })
  }
}

/**
 * Stands in for having finished the setup on "start with nothing": that screen
 * writes exactly this, and driving the whole wizard here would test the wizard
 * rather than what reads the flag.
 */
async function markPresetsPending(page: Page) {
  await page.goto(LIST_VIEW)
  await page.evaluate(() => {
    localStorage.setItem('presetWorldsPending', 'true')
  })
}

async function openListView(page: Page) {
  await page.goto(LIST_VIEW)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

const notice = (page: Page) => page.getByTestId('preset-worlds-notice')

const dismissNotice = (page: Page) =>
  page.getByRole('button', { name: jaJP['general:close'], exact: true }).click()

/**
 * A world card writes its name as a level-3 heading. Scoped to the content
 * column because the sidebar has one of its own, which would otherwise be
 * counted as a world and put the order out by one.
 */
const cardNames = (page: Page) =>
  page.getByTestId('list-view-content').getByRole('heading', { level: 3 })

test.describe('the worlds a device is started off with', () => {
  test('are added on the first list view, in the order they were asked for', async ({
    page,
  }) => {
    await describeThePresets(page)
    await markPresetsPending(page)
    await openListView(page)

    await expect(notice(page)).toBeVisible()
    // The dialog is modal, and Radix hides the rest of the page from the
    // accessibility tree while it is open -- the grid is unreadable until it
    // has been closed.
    await dismissNotice(page)

    // The list opens on "date added", newest first, so what the grid shows top
    // to bottom has to be the order the ids are written in.
    await expect(cardNames(page)).toHaveCount(PRESET_WORLD_IDS.length)
    const shown = await cardNames(page).allInnerTexts()
    expect(shown.slice(0, PRESET_WORLD_IDS.length)).toEqual(
      PRESET_WORLD_IDS.map((_, index) => nameOfPreset(index)),
    )
  })

  test('say what they are for, and the notice closes', async ({ page }) => {
    await describeThePresets(page)
    await markPresetsPending(page)
    await openListView(page)

    await expect(notice(page)).toContainText(jaJP['preset-worlds:notice-title'])
    await expect(notice(page)).toContainText('フォルダ分け')
    await expect(notice(page)).toContainText('ファイルバックアップ')

    await dismissNotice(page)
    await expect(notice(page)).toBeHidden()
  })

  // Otherwise a second visit adds them again, on top of the ones already there.
  test('are added once, not again on the next visit', async ({ page }) => {
    await describeThePresets(page)
    await markPresetsPending(page)
    await openListView(page)
    await expect(notice(page)).toBeVisible()
    await dismissNotice(page)

    await openListView(page)

    await expect(notice(page)).toHaveCount(0)
    await expect(cardNames(page)).toHaveCount(PRESET_WORLD_IDS.length)
  })

  // The whole of what the reader sees while the ten are on their way: an
  // empty grid that never reacted to being opened reads as an app that did
  // not start.
  test('spin something unnamed while the worlds are on their way', async ({
    page,
  }) => {
    await describeThePresets(page, { delayMs: 120 })
    await markPresetsPending(page)
    await openListView(page)

    await expect(page.getByTestId('preset-worlds-spinner')).toBeVisible()

    await expect(notice(page)).toBeVisible()
    await expect(page.getByTestId('preset-worlds-spinner')).toHaveCount(0)
  })

  // Nothing says so, because nothing was promised -- the grid goes back to
  // being the ordinary empty list.
  test('stop the spinner without a word when a world cannot be fetched', async ({
    page,
  }) => {
    await describeThePresets(page, {
      failing: [PRESET_WORLD_IDS[4]],
      delayMs: 60,
    })
    await markPresetsPending(page)
    await openListView(page)

    await expect(page.getByTestId('preset-worlds-spinner')).toBeVisible()
    await expect(page.getByTestId('preset-worlds-spinner')).toHaveCount(0)
    await expect(notice(page)).toHaveCount(0)
    await expect(
      page.getByText(jaJP['listview-page:no-worlds-all']),
    ).toBeVisible()
  })

  // A half-filled collection is worse than an empty one: the order is wrong,
  // and the notice would be claiming worlds that are not there.
  test('are not added at all when one of them cannot be fetched', async ({
    page,
  }) => {
    await describeThePresets(page, { failing: [PRESET_WORLD_IDS[4]] })
    await markPresetsPending(page)
    await openListView(page)

    await expect(notice(page)).toHaveCount(0)
    await expect(cardNames(page)).toHaveCount(0)

    // The flag is kept, so the next list view is free to try again.
    expect(
      await page.evaluate(() => localStorage.getItem('presetWorldsPending')),
    ).toBe('true')
  })
})

/**
 * Leaving the list half way through the run: the fetches are not tied to the
 * screen that started them, and the next screen must not start its own.
 */
test.describe('a list view left while the worlds are still coming', () => {
  const DESKTOP = { width: 1280, height: 900 }

  test('finishes the run and shows the notice on the page moved to', async ({
    page,
  }) => {
    const asked: string[] = []
    await describeThePresets(page, { delayMs: 120, asked })
    // Before the flag is written: a resize remounts the list view, and a
    // remount with the flag already set starts a run that the `goto` below
    // then reloads away -- a request this test would count as a second run.
    await page.setViewportSize(DESKTOP)
    await markPresetsPending(page)
    await openListView(page)
    await expect(page.getByTestId('preset-worlds-spinner')).toBeVisible()

    // The sidebar navigates within the same document -- a `goto` here would be
    // a reload, which really does cancel the fetches, and is not what tapping
    // a folder does.
    await page
      .getByText(jaJP['general:unclassified-worlds'], { exact: true })
      .click()
    await expect(page).toHaveURL(/special\/unclassified$/)

    await expect(notice(page)).toBeVisible()
    await dismissNotice(page)
    await expect(cardNames(page)).toHaveCount(PRESET_WORLD_IDS.length)

    // Ten worlds, ten requests: the page moved to joined the run rather than
    // starting a second one of its own.
    expect(asked).toHaveLength(PRESET_WORLD_IDS.length)
  })
})

/**
 * The other half: the setup is what decides a device is owed them, and it
 * decides it from one answer alone.
 */
test.describe('what the setup records about starting with nothing', () => {
  const openTheRestoreStep = async (page: Page) => {
    await page.goto('/setup')
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })
    await page.getByRole('button', { name: jaJP['setup-layout:start'] }).click()
    await page.getByRole('button', { name: jaJP['general:next'] }).click()
    await expect(
      page.getByText(jaJP['setup-page:restore-source-description']),
    ).toBeVisible()
  }

  const choose = (page: Page, titleKey: keyof typeof jaJP) =>
    page.getByRole('button', { name: jaJP[titleKey] }).click()

  const pendingFlag = (page: Page) =>
    page.evaluate(() => localStorage.getItem('presetWorldsPending'))

  /**
   * Presses "next" through whatever appearance screens this route has left,
   * then finishes. Counting them here would make this spec fail for a screen
   * added to the setup, which is not what it is about.
   */
  const walkToTheEnd = async (page: Page) => {
    const finish = page.getByRole('button', {
      name: jaJP['setup-layout:finish'],
    })
    for (let step = 0; step < 8; step++) {
      if ((await finish.count()) > 0) {
        await finish.click()
        return
      }
      await page.getByRole('button', { name: jaJP['general:next'] }).click()
    }
    throw new Error('the setup never offered a way to finish')
  }

  test('is written when the answer was "start with nothing"', async ({
    page,
  }) => {
    await openTheRestoreStep(page)
    await choose(page, 'setup-page:restore-source-fresh-title')

    await walkToTheEnd(page)

    await expect(page).toHaveURL(/\/login$/)
    expect(await pendingFlag(page)).toBe('true')
  })

  // A restored collection has worlds in it already; adding ten more on top of
  // someone's own is not a welcome, it is a mess to clean up.
  test('is not written when the data came from somewhere', async ({ page }) => {
    await stubGoogleAuth(page, { token: 'test-access-token' })
    await stubGoogleDrive(page)

    await openTheRestoreStep(page)
    await choose(page, 'setup-page:restore-source-drive-title')
    await walkToTheEnd(page)

    await expect(page).toHaveURL(/\/login$/)
    expect(await pendingFlag(page)).toBe(null)
  })

  // Going back and picking a restore instead has to unrecord the first answer.
  test('is not written when "start with nothing" was taken back', async ({
    page,
  }) => {
    await stubGoogleAuth(page, { token: 'test-access-token' })
    await stubGoogleDrive(page)

    await openTheRestoreStep(page)
    await choose(page, 'setup-page:restore-source-fresh-title')
    // The wizard's own back button, not the browser's: this has to be the same
    // mounted component, or the answer would be forgotten by the reload rather
    // than by the code under test.
    await page.getByRole('button', { name: jaJP['general:back'] }).click()
    await expect(
      page.getByText(jaJP['setup-page:restore-source-description']),
    ).toBeVisible()
    await choose(page, 'setup-page:restore-source-drive-title')
    await walkToTheEnd(page)

    await expect(page).toHaveURL(/\/login$/)
    expect(await pendingFlag(page)).toBe(null)
  })
})
