import { expect, test } from '@playwright/test'
import enUS from '../../locales/en-US.json'

/**
 * Google's brand verification fetches the home page and refuses the consent
 * screen's branding unless it finds the app's own name there and a sentence
 * saying what the app is for. It found neither the first time round: the name
 * was in an `alt` attribute and the purpose only in a `<meta>` (#107).
 *
 * Fetched without a browser on purpose -- nothing waits for the redirect that
 * `/` runs, so what the server hands back is the whole of what is checked.
 */
test('the home page states the app name and what it is for, without running any script', async ({
  request,
}) => {
  const response = await request.get('/')
  expect(response.ok()).toBe(true)

  const html = await response.text()
  expect(html).toContain('<h1 class="text-xl font-semibold">')
  expect(html).toContain('VRChat Worlds Manager Web')
  expect(html).toContain(enUS['home:tagline'])
})

test('the launch screen shows them to a person too', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', { name: 'VRChat Worlds Manager Web' }),
  ).toBeVisible()
})

test('the launch screen fits a narrow panel', async ({ page }) => {
  // Narrower than any phone this is used on, and narrower than the app name,
  // which has to wrap rather than push the page sideways.
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/')

  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  )
  expect(overflows).toBe(false)
})

/**
 * The two proofs that this domain is ours, which is what Google's brand
 * verification for the OAuth consent screen rests on. `pages.dev` gives us no
 * DNS to prove ownership with, so these are the only methods open to us, and
 * deleting either revokes what it proves.
 *
 * The file is only ever served through Cloudflare's 308 from `.html` to the
 * extensionless path -- which is why the meta tag is carried as well.
 */
test.describe('proving the domain is ours', () => {
  test('the home page carries the Search Console meta tag', async ({
    request,
  }) => {
    const response = await request.get('/')

    expect(response.ok()).toBe(true)
    expect(await response.text()).toContain(
      '<meta name="google-site-verification" content="F0K7K2bqSmwGscKVE1YWHcmyAwfEWD0Nf3Yb2Rba7SQ"',
    )
  })

  test('the Search Console file still answers, redirect and all', async ({
    request,
  }) => {
    const response = await request.get('/google1115d8bfd0d506b1.html')

    expect(response.ok()).toBe(true)
    expect(await response.text()).toContain(
      'google-site-verification: google1115d8bfd0d506b1.html',
    )
  })
})
