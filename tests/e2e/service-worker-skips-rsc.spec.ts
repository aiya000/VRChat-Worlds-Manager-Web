import { expect, test } from '@playwright/test'

/**
 * Every URL held in any of the service worker's caches.
 */
async function cachedUrls(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    const urls: string[] = []
    for (const name of await caches.keys()) {
      const cache = await caches.open(name)
      for (const request of await cache.keys()) {
        urls.push(request.url)
      }
    }
    return urls
  })
}

// What the router fetches to move between pages used to be cached like a
// static asset, and the second trip back from Google was answered from that
// cache: Next 16.4 dropped the navigation and the screen never left
// /google-auth (#226).
test('leaves what the router fetches for a navigation out of its cache', async ({
  page,
}) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })

  const navigationFetched = page.waitForResponse(
    (response) => response.request().headers()['rsc'] === '1',
  )
  await page.locator('a[href="/terms"]').first().click()
  await navigationFetched
  await page.waitForURL('**/terms')

  // The worker is still caching what it should: the page's own scripts, which
  // are put in the cache the same way an RSC answer used to be.
  await expect
    .poll(async () =>
      (await cachedUrls(page)).some((url) => url.includes('/_next/static/')),
    )
    .toBe(true)
  expect(
    (await cachedUrls(page)).filter((url) => url.includes('_rsc=')),
  ).toEqual([])
})
