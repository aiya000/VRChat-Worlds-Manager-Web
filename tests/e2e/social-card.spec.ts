import { expect, test } from '@playwright/test'

const PRODUCTION = 'https://vrchat-worlds-manager-web.pages.dev'

function metaContent(property: string) {
  return `meta[property="${property}"]`
}

function namedMetaContent(name: string) {
  return `meta[name="${name}"]`
}

/**
 * A link to this app used to arrive in X or Discord as a bare URL: the head
 * carried a title and description in English and nothing else. These tags are
 * what turn it into a card, and they are baked into the static HTML, so the
 * runtime locale never reaches them.
 */
test.describe('the card this app shows when its link is shared', () => {
  test('names the app and what it does, in Japanese', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/VRChat のお気に入りワールドを整理する/)
    await expect(page.locator(namedMetaContent('description'))).toHaveAttribute(
      'content',
      /VRChat のお気に入りワールド/,
    )
    await expect(page.locator(metaContent('og:title'))).toHaveAttribute(
      'content',
      /VRChat のお気に入りワールドを整理する/,
    )
    await expect(page.locator(metaContent('og:description'))).toHaveAttribute(
      'content',
      /VRChat のお気に入りワールド/,
    )
    await expect(page.locator(metaContent('og:locale'))).toHaveAttribute(
      'content',
      'ja_JP',
    )
    await expect(page.locator(metaContent('og:site_name'))).toHaveAttribute(
      'content',
      'VRChat Worlds Manager Web',
    )
  })

  test('points at an image by absolute URL, with its size declared', async ({
    page,
  }) => {
    await page.goto('/')

    // A crawler has no page to resolve a relative path against, so the URL has
    // to be absolute even though the app is served as static files.
    await expect(page.locator(metaContent('og:image'))).toHaveAttribute(
      'content',
      `${PRODUCTION}/og-image.png`,
    )
    await expect(page.locator(metaContent('og:image:width'))).toHaveAttribute(
      'content',
      '1200',
    )
    await expect(page.locator(metaContent('og:image:height'))).toHaveAttribute(
      'content',
      '630',
    )
    await expect(
      page.locator(namedMetaContent('twitter:card')),
    ).toHaveAttribute('content', 'summary_large_image')
    await expect(
      page.locator(namedMetaContent('twitter:image')),
    ).toHaveAttribute('content', `${PRODUCTION}/og-image.png`)
  })

  test('serves the image it advertises, at the size it claims', async ({
    page,
  }) => {
    // `page.evaluate` needs an origin to resolve the path against.
    await page.goto('/')

    const response = await page.request.get('/og-image.png')
    expect(response.status()).toBe(200)
    expect(response.headers()['content-type']).toContain('image/png')

    const drawn = await page.evaluate(
      () =>
        new Promise<{ width: number; height: number }>((resolve, reject) => {
          const image = new Image()
          image.onload = () =>
            resolve({ width: image.naturalWidth, height: image.naturalHeight })
          image.onerror = () => reject(new Error('the OG image did not load'))
          image.src = '/og-image.png'
        }),
    )
    expect(drawn).toEqual({ width: 1200, height: 630 })
  })
})
