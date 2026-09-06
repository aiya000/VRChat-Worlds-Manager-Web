import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const DB_NAME = 'VRChatWorldsManager'

/**
 * Puts the browser in the state a stale bundle finds itself in: a database
 * already upgraded past what this build knows how to open, which is what
 * happens to an offline shell, or to a tab left open across a release that
 * changed the schema.
 *
 * The version to jump to is read from the database the app has just opened
 * rather than written down here. A number spelled out in this file silently
 * becomes the current version the next time the schema changes, and the test
 * then passes while standing in for nothing at all.
 */
async function upgradeDatabaseBeyondThisBuild(page: Page) {
  await page.evaluate(async (name: string) => {
    const versionTheAppOpened = async (): Promise<number> => {
      for (let attempt = 0; attempt < 100; attempt++) {
        const found = (await indexedDB.databases()).find(
          (entry) => entry.name === name,
        )
        if (found?.version !== undefined && found.version > 0) {
          return found.version
        }
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
      throw new Error('the app never opened its database')
    }

    // Dexie multiplies its own schema version by ten, so the next schema
    // version is ten higher on disk.
    const version = (await versionTheAppOpened()) + 10

    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(name, version)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('worlds')) {
          request.result.createObjectStore('worlds', { keyPath: 'worldId' })
        }
      }
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
  }, DB_NAME)
}

test('says nothing while the bundle and the database agree', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.locator('[role="alertdialog"]')).toHaveCount(0)
})

test('asks for a reload when the database is newer than the bundle', async ({
  page,
}) => {
  await page.goto('/')
  await upgradeDatabaseBeyondThisBuild(page)
  await page.reload()

  const notice = page.locator('[role="alertdialog"]')

  await expect(notice).toBeVisible()
  await expect(notice.getByText(jaJP['stale-bundle:title'])).toBeVisible()
  await expect(
    notice.getByRole('button', { name: jaJP['stale-bundle:reload'] }),
  ).toBeVisible()
})

test('throws away what was serving the old bundle before reloading', async ({
  page,
}) => {
  await page.goto('/')
  await upgradeDatabaseBeyondThisBuild(page)
  await page.reload()

  // A cache left by an earlier build. This is what hands the old bundle back
  // on the next load, so a reload that leaves it there is not an escape: the
  // notice returns and the button is scenery.
  await page.evaluate(async () => {
    const cache = await caches.open('vrcww-an-earlier-build')
    await cache.put('/', new Response('<!doctype html>an older shell'))
  })
  expect(await page.evaluate(() => caches.keys())).toContain(
    'vrcww-an-earlier-build',
  )

  await page
    .locator('[role="alertdialog"]')
    .getByRole('button', { name: jaJP['stale-bundle:reload'] })
    .click()

  // The button clears up before it reloads, so what is being waited for is
  // the clearing, not the navigation.
  await expect
    .poll(() => page.evaluate(() => caches.keys()))
    .not.toContain('vrcww-an-earlier-build')
})

test('keeps the notice reachable on a narrow VR panel', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto('/')
  await upgradeDatabaseBeyondThisBuild(page)
  await page.reload()

  const reload = page
    .locator('[role="alertdialog"]')
    .getByRole('button', { name: jaJP['stale-bundle:reload'] })

  await expect(reload).toBeVisible()

  // A VR controller aims a laser, so the one control here has to be a big target.
  const box = await reload.boundingBox()
  expect(box?.height ?? 0).toBeGreaterThanOrEqual(40)
})
