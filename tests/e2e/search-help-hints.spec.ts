import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const SEARCH = '/listview/search'

/**
 * The two "?" beside the search fields used to be tooltips and nothing else,
 * so their sentences could be read with a mouse and in no other way. A phone
 * and a VR laser have no hover.
 */
async function openTheSearchPage(page: Page) {
  await page.goto(SEARCH)
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
}

test.describe('the "?" beside the search fields', () => {
  test('explains the sort field on a tap, not only on hover', async ({
    page,
  }) => {
    await openTheSearchPage(page)

    // The sort "?" only appears while a keyword is fixing the order.
    await page
      .getByLabel(jaJP['find-page:search-query'])
      .fill('a world to look for')

    await page.getByTestId('find-sort-help').click()
    const explanation = page.getByTestId('find-sort-explanation')
    await expect(explanation).toBeVisible()
    await expect(
      explanation.getByText(jaJP['find-page:sort-help-why-title']),
    ).toBeVisible()

    await page.getByRole('button', { name: jaJP['general:close'] }).click()
    await expect(explanation).toBeHidden()
  })

  test('explains the excluded tags field on a tap', async ({ page }) => {
    await openTheSearchPage(page)

    await page.getByTestId('find-exclude-tag-help').click()
    const explanation = page.getByTestId('find-exclude-tag-explanation')
    await expect(explanation).toBeVisible()
    await expect(
      explanation.getByText(jaJP['find-page:exclude-tag-help-what-title']),
    ).toBeVisible()
  })
})
