import { expect, test } from '@playwright/test'
import enUS from '../../locales/en-US.json'
import jaJP from '../../locales/ja-JP.json'

/**
 * Google's brand verification refuses the OAuth consent screen's branding
 * unless the home page it is given names the app, says what the app is for,
 * says why it wants the Google account it asks for, and links the privacy
 * policy -- and unless the page is still there when a person opens it.
 *
 * `/` was the screen that decided where the app starts, and it replaced
 * itself the moment it loaded. Putting the name and the purpose into its
 * static HTML was not enough: the check is a person with a browser, and the
 * redirect took them to the setup wizard before they read a word (#107).
 */
test.describe('the home page a brand review is given', () => {
  test('names the app and says what it is for, without running any script', async ({
    request,
  }) => {
    const response = await request.get('/')
    expect(response.ok()).toBe(true)

    const html = await response.text()
    expect(html).toContain('VRChat Worlds Manager Web')
    expect(html).toContain(enUS['home:tagline'])
    expect(html).toContain(enUS['home:google-title'])
    expect(html).toContain('drive.file')
  })

  test('shows all of it to a person too', async ({ page }) => {
    await page.goto('/')

    await expect(
      page.getByRole('heading', { name: 'VRChat Worlds Manager Web' }),
    ).toBeVisible()
    await expect(page.getByText(jaJP['home:tagline'])).toBeVisible()
    await expect(
      page.getByRole('heading', { name: jaJP['home:google-title'] }),
    ).toBeVisible()
    await expect(
      page.getByRole('link', { name: jaJP['privacy-policy:link-label'] }),
    ).toBeVisible()
  })

  /**
   * The one that the three refusals came down to. A home page that sends the
   * reviewer somewhere else is a home page they never read.
   */
  test('stays put rather than sending anyone on', async ({ page }) => {
    await page.goto('/')

    // Longer than the sign-in check the launch screen waits on, so a redirect
    // would have landed by now if one were coming.
    await page.waitForTimeout(3000)

    await expect(page).toHaveURL(/\/$/)
  })

  test('enters the app only when the button is pressed', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('link', { name: jaJP['home:open-app'] }).click()

    await expect(page).toHaveURL(/\/(start|setup)/)
  })

  test('fits a narrow panel', async ({ page }) => {
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
})

/**
 * What an installed app opens at. If this went back to `/` the landing page
 * would stand between every launch and the app.
 */
test('the installed app starts at the launch screen, not the landing page', async ({
  request,
}) => {
  const response = await request.get('/manifest.json')

  expect(response.ok()).toBe(true)
  expect((await response.json()).start_url).toBe('/start')
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
