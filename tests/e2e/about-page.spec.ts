import { expect, test } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const ABOUT = '/listview/about'
const CREDITS = '/listview/about/credits'

const RELEASES_URL =
  'https://github.com/aiya000/VRChat-Worlds-Manager-Web/releases'

// The app ships no changelog of its own; GitHub Releases is the changelog, and
// this link is the only way a user reaches it.
test('the About page links to GitHub Releases as the changelog', async ({
  page,
}) => {
  await page.goto(ABOUT)

  const link = page.getByRole('link', { name: jaJP['about-section:changelog'] })

  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', RELEASES_URL)
  await expect(link).toHaveAttribute('target', '_blank')
})

test('the About footer wraps instead of overflowing a narrow panel', async ({
  page,
}) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(ABOUT)

  await expect(
    page.getByRole('link', { name: jaJP['about-section:changelog'] }),
  ).toBeVisible()

  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  )
  expect(overflows).toBe(false)
})

/**
 * "About this app" is one row in the sidebar and three pages behind it: the
 * terms, the privacy policy and the credits. Three rows in the sidebar would
 * have cost three folders on a phone, where the sidebar is the whole screen,
 * and "Credits" was a name that said nothing about the two documents filed
 * under it.
 */
test('the About page leads to each of the three pages behind it', async ({
  page,
}) => {
  await page.goto(ABOUT)

  await expect(
    page.getByRole('heading', { name: jaJP['about-section:title'] }),
  ).toBeVisible()

  for (const [label, href] of [
    [jaJP['terms:link-label'], `/terms?back=${encodeURIComponent(ABOUT)}`],
    [
      jaJP['privacy-policy:link-label'],
      `/privacy?back=${encodeURIComponent(ABOUT)}`,
    ],
    [jaJP['about-section:credits-title'], CREDITS],
  ] as const) {
    await expect(page.getByRole('link', { name: label })).toHaveAttribute(
      'href',
      href,
    )
  }
})

test('the credits are a page of their own, with the way back to the About page', async ({
  page,
}) => {
  await page.goto(ABOUT)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })

  await page
    .getByText(jaJP['about-section:credits-title'], { exact: true })
    .click()

  await expect(page).toHaveURL(new RegExp(`${CREDITS}$`))
  await expect(
    page.getByText(jaJP['about-section:original-title']),
  ).toBeVisible()
  await expect(
    page.getByText(jaJP['about-section:special-thanks']),
  ).toBeVisible()

  await page.getByRole('link', { name: jaJP['about-section:back'] }).click()
  await expect(page).toHaveURL(new RegExp(`${ABOUT}$`))
})

test('the credits fit a narrow panel', async ({ page }) => {
  await page.setViewportSize({ width: 400, height: 800 })
  await page.goto(CREDITS)

  await expect(
    page.getByText(jaJP['about-section:credits-title']),
  ).toBeVisible()

  const overflows = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  )
  expect(overflows).toBe(false)
})
