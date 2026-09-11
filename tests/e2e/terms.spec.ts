import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { stubTurnstile } from './stub-turnstile'

const TERMS = '/terms'
const PRIVACY = '/privacy'
const ABOUT = '/listview/about'

async function hideDevOverlay(page: Page) {
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

test('the terms of use page states every clause', async ({ page }) => {
  await page.goto(TERMS)

  await expect(
    page.getByRole('heading', { name: jaJP['terms:title'] }),
  ).toBeVisible()

  for (const section of [
    'terms:app-title',
    'terms:vrchat-title',
    'terms:account-title',
    'terms:prohibited-title',
    'terms:disclaimer-title',
    'terms:data-title',
    'terms:ip-title',
    'terms:changes-title',
    'terms:law-title',
    'terms:contact-title',
  ] as const) {
    await expect(page.getByText(jaJP[section], { exact: true })).toBeVisible()
  }

  // The two clauses the terms exist for: a ban is not on the operator, and
  // neither is anything done to the relay from outside the app.
  await expect(page.getByText(jaJP['terms:disclaimer-item-ban'])).toBeVisible()
  await expect(
    page.getByText(jaJP['terms:disclaimer-item-direct']),
  ).toBeVisible()

  for (const url of [
    'https://hello.vrchat.com/legal',
    'https://hello.vrchat.com/community-guidelines',
    'https://hello.vrchat.com/creator-guidelines',
  ]) {
    await expect(page.getByRole('link', { name: url })).toHaveAttribute(
      'href',
      url,
    )
  }
})

// Reachable from every screen that leads up to signing in, and from the About
// page after it. Not from the sidebar: its footer row is full, and a row it
// gains is a folder pushed out of view on a phone (see guide-page.spec.ts).
test('the About footer links to the terms of use', async ({ page }) => {
  await page.goto(ABOUT)

  await expect(
    page.getByRole('link', { name: jaJP['terms:link-label'] }),
  ).toHaveAttribute('href', TERMS)
})

test('the setup screen links to the terms of use', async ({ page }) => {
  await page.goto('/setup')
  await hideDevOverlay(page)

  await expect(
    page.getByRole('link', { name: jaJP['terms:link-label'] }),
  ).toHaveAttribute('href', TERMS)
})

test('the home page links to the terms of use without running any script', async ({
  request,
}) => {
  const response = await request.get('/')

  expect(response.ok()).toBe(true)
  expect(await response.text()).toContain(`href="${TERMS}"`)
})

test('the terms of use fit a narrow panel', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(TERMS)

  await expect(
    page.getByRole('heading', { name: jaJP['terms:title'] }),
  ).toBeVisible()

  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  )
  expect(overflows).toBe(false)
})

// Signing in is what agrees to the terms. The screen says so above the
// button, with both documents one tap away, and the version agreed to is
// written down once the sign-in has gone through -- and not before.
test.describe('agreeing by signing in', () => {
  // The service worker would make the sign-in request itself, and the route
  // below would never see it.
  test.use({ serviceWorkers: 'block' })

  const acceptedVersion = (page: Page) =>
    page.evaluate(() => localStorage.getItem('termsAcceptedVersion'))

  test('the login screen says that signing in agrees, and links to both documents', async ({
    page,
  }) => {
    await page.goto('/login')

    await expect(page.getByText(jaJP['login-page:terms-text'])).toBeVisible()
    await expect(
      page.getByRole('link', { name: jaJP['terms:link-label'] }),
    ).toHaveAttribute('href', TERMS)
    await expect(
      page.getByRole('link', { name: jaJP['privacy-policy:link-label'] }),
    ).toHaveAttribute('href', PRIVACY)
    expect(await acceptedVersion(page)).toBeNull()
  })

  test('records the version agreed to once the sign-in goes through', async ({
    page,
  }) => {
    await stubTurnstile(page)
    await page.route('**/api/1/**', async (route) => {
      const path = new URL(route.request().url()).pathname.replace(
        /^\/api\/1/,
        '',
      )
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
    await page.goto('/login')
    await hideDevOverlay(page)

    await page
      .getByPlaceholder(jaJP['login-page:username-placeholder'])
      .fill('someone')
    await page
      .getByPlaceholder(jaJP['login-page:password-placeholder'])
      .fill('hunter2')
    await page
      .getByRole('button', { name: jaJP['login-page:login-button'] })
      .click()
    await expect(page.getByText(jaJP['login-page:2fa-title'])).toBeVisible()
    // The password alone has not agreed to anything yet.
    expect(await acceptedVersion(page)).toBeNull()

    await page
      .getByPlaceholder(jaJP['login-page:2fa-placeholder'])
      .fill('123456')
    await page
      .getByRole('button', { name: jaJP['login-page:2fa-button'] })
      .click()

    await page.waitForURL(/\/listview/)
    expect(await acceptedVersion(page)).toBe('2026-09-12')
  })
})
