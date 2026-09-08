import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { stubTurnstile, turnstileChallenges } from './stub-turnstile'

const TOKEN_HEADER = 'x-turnstile-token'

// The service worker would make the same-origin sign-in request on the
// page's behalf, and the route below would never see what it carried.
test.use({ serviceWorkers: 'block' })

/**
 * The VRChat API behind the Worker, answering a sign-in that needs a second
 * factor and then the code for it. What each request carried as its bot-check
 * token is kept, since that is the whole question here.
 */
async function stubVRChatApi(
  page: Page,
  options: { refuseSignIn?: boolean } = {},
) {
  const tokens: { path: string; token: string | null }[] = []

  await page.route('**/api/1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace(/^\/api\/1/, '')
    const authorization = request.headers()['authorization']
    const isCredentialAttempt =
      (path === '/auth/user' && authorization !== undefined) ||
      /^\/auth\/twofactorauth\/[^/]+\/verify$/.test(path)
    if (isCredentialAttempt) {
      tokens.push({ path, token: request.headers()[TOKEN_HEADER] ?? null })
    }

    if (path === '/auth/user' && options.refuseSignIn === true) {
      // What the Worker answers when the token does not satisfy Cloudflare.
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'bot-check-failed',
          codes: ['invalid-input-response'],
        }),
      })
      return
    }
    if (path === '/auth/user') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ requiresTwoFactorAuth: ['totp'] }),
      })
      return
    }
    if (path === '/auth/twofactorauth/totp/verify') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'X-VRC-Auth': 'authcookie_signed_in' },
        body: JSON.stringify({ verified: true }),
      })
      return
    }
    await route.fulfill({ status: 404, body: 'not stubbed' })
  })

  return { tokens }
}

async function openTheSignIn(page: Page) {
  await page.goto('/login')
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
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

async function enterTheCode(page: Page) {
  await page.getByPlaceholder(jaJP['login-page:2fa-placeholder']).fill('123456')
  await page
    .getByRole('button', { name: jaJP['login-page:2fa-button'] })
    .click()
}

/**
 * The Worker's `Origin` check stops nothing that is not a browser, so a
 * credential attempt has to bring proof that a browser ran Cloudflare's
 * challenge (#61). The e2e server is built with a site key, so what is
 * checked here is that the proof is fetched, sent, and fetched again for the
 * second factor -- a token is single-use -- and that a refusal is put into
 * words rather than shown as a status code.
 */
test.describe('the bot check in front of a sign-in', () => {
  test('sends a fresh token with the password, and another with the code', async ({
    page,
  }) => {
    await stubTurnstile(page)
    const api = await stubVRChatApi(page)
    await openTheSignIn(page)

    await signIn(page)
    await expect(page.getByText(jaJP['login-page:2fa-title'])).toBeVisible()
    await enterTheCode(page)
    await expect.poll(() => api.tokens.length).toBe(2)

    expect(api.tokens.map((t) => t.path)).toEqual([
      '/auth/user',
      '/auth/twofactorauth/totp/verify',
    ])
    expect(api.tokens[0].token).toMatch(/^dummy-token-/)
    expect(api.tokens[1].token).toMatch(/^dummy-token-/)
    expect(api.tokens[0].token).not.toBe(api.tokens[1].token)
    expect(await turnstileChallenges(page)).toBe(2)
  })

  test('says the check did not pass when the challenge itself fails', async ({
    page,
  }) => {
    await stubTurnstile(page, { fails: '110200' })
    const api = await stubVRChatApi(page)
    await openTheSignIn(page)

    await signIn(page)

    await expect(
      page.getByText(jaJP['login-page:error-bot-check']),
    ).toBeVisible()
    // Nothing went out: there was no token to send.
    expect(api.tokens).toHaveLength(0)
  })

  test('says the check did not pass when the Worker turns the token down', async ({
    page,
  }) => {
    await stubTurnstile(page)
    await stubVRChatApi(page, { refuseSignIn: true })
    await openTheSignIn(page)

    await signIn(page)

    await expect(
      page.getByText(jaJP['login-page:error-bot-check']),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: jaJP['login-page:login-button'] }),
    ).toBeEnabled()
  })
})
