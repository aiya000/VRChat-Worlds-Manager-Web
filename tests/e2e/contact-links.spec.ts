import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import {
  CONTACT_DISCORD_URL,
  CONTACT_ISSUES_URL,
} from '../../src/components/contact-links'

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
