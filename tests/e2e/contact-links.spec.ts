import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import {
  CONTACT_DISCORD_URL,
  CONTACT_ISSUES_URL,
  CONTACT_PAGE_PATH,
} from '../../src/components/contact-links'

const ABOUT = '/listview/about'
const GUIDE = '/listview/guide'

// The dev overlay sits over the whole page and swallows clicks.
const hideDevOverlay = (page: Page) =>
  page.addStyleTag({ content: 'nextjs-portal { display: none !important; }' })

const issuesLink = (page: Page) =>
  page.locator(`a[href="${CONTACT_ISSUES_URL}"]`)
const discordLink = (page: Page) =>
  page.locator(`a[href="${CONTACT_DISCORD_URL}"]`)

/**
 * Opening an issue asks for a GitHub account, which plenty of people who use
 * VRChat do not have. Wherever the app says "get in touch", the Discord invite
 * has to be there beside it -- and the setup screens most of all, because they
 * are where someone who cannot get past the first screen is standing.
 */
test.describe('the ways offered to get in touch', () => {
  test('are both on the welcome screen', async ({ page }) => {
    await page.goto('/setup')
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })
    await page.getByRole('button', { name: jaJP['setup-layout:start'] }).click()

    await expect(page.getByText(jaJP['setup-page:thank-you'])).toBeVisible()
    await expect(issuesLink(page)).toBeVisible()
    await expect(discordLink(page)).toBeVisible()
  })

  test('are both on the screen the setup ends with', async ({ page }) => {
    await page.goto('/setup')
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })
    await page.getByRole('button', { name: jaJP['setup-layout:start'] }).click()
    await page.getByRole('button', { name: jaJP['general:next'] }).click()
    await page
      .getByRole('button', {
        name: jaJP['setup-page:restore-source-fresh-title'],
      })
      .click()

    const next = page.getByRole('button', { name: jaJP['general:next'] })
    for (let step = 0; step < 8; step++) {
      if ((await page.getByText(jaJP['setup-page:all-set']).count()) > 0) {
        break
      }
      await next.click()
    }

    await expect(page.getByText(jaJP['setup-page:all-set'])).toBeVisible()
    await expect(issuesLink(page)).toBeVisible()
    await expect(discordLink(page)).toBeVisible()
  })

  // They open away from the app, and an unsandboxed `target="_blank"` hands
  // the opened page a handle back to this one.
  test('open in a new tab without handing it this window', async ({ page }) => {
    await page.goto('/setup')
    await page.getByRole('button', { name: jaJP['setup-layout:start'] }).click()

    for (const link of [issuesLink(page), discordLink(page)]) {
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', /noopener/)
    }
  })
})

/**
 * A footer has room for one link, and picking Discord for it told a reader
 * with no Discord account that reporting was not for them. The link now goes
 * to a page that names both, so no screen has to choose on their behalf.
 */
test.describe('the page that holds both ways to report', () => {
  test('is where the About footer goes, rather than straight to Discord', async ({
    page,
  }) => {
    await page.goto(ABOUT)
    await hideDevOverlay(page)

    const report = page.getByRole('link', {
      name: jaJP['about-section:report-issue'],
    })
    await expect(report).toHaveAttribute('href', CONTACT_PAGE_PATH)

    await report.click()
    await expect(page).toHaveURL(new RegExp(`${CONTACT_PAGE_PATH}$`))
  })

  test('offers the two as alternatives, either of which will do', async ({
    page,
  }) => {
    await page.goto(CONTACT_PAGE_PATH)

    await expect(page.getByText(jaJP['contact-page:description'])).toBeVisible()
    await expect(issuesLink(page)).toBeVisible()
    await expect(
      page.getByText(jaJP['contact-page:or'], { exact: true }),
    ).toBeVisible()
    await expect(discordLink(page)).toBeVisible()
  })

  test('is at the bottom of the guide, for a reader the guide did not answer', async ({
    page,
  }) => {
    await page.goto(GUIDE)
    await hideDevOverlay(page)

    const report = page.getByRole('link', {
      name: jaJP['about-section:report-issue'],
    })
    await expect(report).toHaveAttribute('href', CONTACT_PAGE_PATH)

    await report.click()
    await expect(page).toHaveURL(new RegExp(`${CONTACT_PAGE_PATH}$`))
  })

  test('leads back to the About page it sits under', async ({ page }) => {
    await page.goto(CONTACT_PAGE_PATH)
    await hideDevOverlay(page)

    await page.getByRole('link', { name: jaJP['about-section:back'] }).click()

    await expect(page).toHaveURL(new RegExp(`${ABOUT}$`))
  })
})
