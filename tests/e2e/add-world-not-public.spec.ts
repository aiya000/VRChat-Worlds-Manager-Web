import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const LIST_VIEW = '/listview/folders/special/all'
const WORLD_ID = 'wrld_11111111-2222-3333-4444-555555555555'
const INSTANCE_ID =
  '48291~private(usr_00000000-0000-0000-0000-000000000000)~region(jp)'
const LAUNCH_URL = `https://vrchat.com/home/launch?worldId=${WORLD_ID}&instanceId=${encodeURIComponent(INSTANCE_ID)}`
const NAME = 'ひみつの部屋'

const NOT_PUBLIC_BODY = JSON.stringify({
  error: { message: '"World is not public"', status_code: 401 },
})

// The worker would otherwise answer the same-origin request itself, and the
// route below would never see it.
test.use({ serviceWorkers: 'block' })

async function refuseTheWorld(page: Page) {
  await page.route(`**/api/1/worlds/${WORLD_ID}`, async (route) => {
    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: NOT_PUBLIC_BODY,
    })
  })
}

async function openAddWorld(page: Page) {
  await page.goto(LIST_VIEW)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await page
    .getByRole('button', { name: jaJP['listview-page:add-world'], exact: true })
    .click()
}

/**
 * A world VRChat will not describe is still a world someone can be standing
 * in, and the link that gets them there is built from the two ids alone. The
 * dialog used to refuse the whole thing the moment the API said no.
 */
test.describe('adding a world VRChat will not describe', () => {
  test('asks for a name instead of refusing, and keeps the world', async ({
    page,
  }) => {
    await refuseTheWorld(page)
    await openAddWorld(page)

    await page
      .getByPlaceholder(jaJP['add-world-dialog:placeholder'])
      .fill(`https://vrchat.com/home/world/${WORLD_ID}`)
    await page
      .getByRole('button', { name: jaJP['add-world-dialog:check'] })
      .click()

    await expect(page.getByTestId('world-unavailable')).toBeVisible()
    await page.getByTestId('manual-world-name').fill(NAME)
    await page
      .getByRole('button', { name: jaJP['add-world-dialog:add'], exact: true })
      .last()
      .click()

    await expect(page.getByRole('dialog')).toBeHidden()
    await expect(page.getByText(NAME).first()).toBeVisible()
  })

  test('keeps the instance a launch link carries, so it can be entered again', async ({
    page,
  }) => {
    await refuseTheWorld(page)
    await openAddWorld(page)

    await page
      .getByPlaceholder(jaJP['add-world-dialog:placeholder'])
      .fill(LAUNCH_URL)
    await page
      .getByRole('button', { name: jaJP['add-world-dialog:check'] })
      .click()

    // The kind is read out of the id itself: `private(...)` without
    // `canRequestInvite` is what the client calls an invite instance.
    const found = page.getByTestId('instance-found')
    await expect(found).toBeVisible()
    await expect(found).toContainText(jaJP['world-detail:invite'])

    await page.getByTestId('manual-world-name').fill(NAME)
    await page
      .getByRole('button', { name: jaJP['add-world-dialog:add'], exact: true })
      .last()
      .click()
    await expect(page.getByRole('dialog')).toBeHidden()

    const saved = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('VRChatWorldsManager')
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      return await new Promise<unknown[]>((resolve, reject) => {
        const store = db
          .transaction('launchedInstances')
          .objectStore('launchedInstances')
        const request = store.getAll()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
    })

    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({
      worldId: WORLD_ID,
      instanceId: INSTANCE_ID,
      instanceType: 'invite',
      region: 'jp',
    })
  })

  test('offers the instance from the world detail afterwards', async ({
    page,
  }) => {
    await refuseTheWorld(page)
    await openAddWorld(page)

    await page
      .getByPlaceholder(jaJP['add-world-dialog:placeholder'])
      .fill(LAUNCH_URL)
    await page
      .getByRole('button', { name: jaJP['add-world-dialog:check'] })
      .click()
    await page.getByTestId('manual-world-name').fill(NAME)
    await page
      .getByRole('button', { name: jaJP['add-world-dialog:add'], exact: true })
      .last()
      .click()
    await expect(page.getByRole('dialog')).toBeHidden()

    await page.getByText(NAME).first().click()

    // VRChat still refuses to describe the world, so the detail falls back to
    // what is stored -- and the instance is stored with it.
    const saved = page.getByRole('group', {
      name: jaJP['world-detail:saved-instances'],
    })
    await expect(saved).toBeVisible()
    await expect(
      saved.getByRole('button', {
        name: new RegExp(jaJP['world-detail:invite']),
      }),
    ).toBeVisible()
    await expect(saved).toContainText('JP')
  })

  test('still refuses text that names no world at all', async ({ page }) => {
    await openAddWorld(page)

    await page
      .getByPlaceholder(jaJP['add-world-dialog:placeholder'])
      .fill('https://vrchat.com/home')
    await page
      .getByRole('button', { name: jaJP['add-world-dialog:check'] })
      .click()

    await expect(
      page.getByText(jaJP['add-world-dialog:invalid-input']),
    ).toBeVisible()
    await expect(page.getByTestId('world-unavailable')).toBeHidden()
  })
})
