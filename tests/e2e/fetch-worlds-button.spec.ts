import { expect, test } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'

const LIST_VIEW = '/listview/folders/special/all'
const RECENTLY_VISITED = '/listview/recently-visited'

/**
 * The button that fetches worlds from VRChat used to read "Refresh" with the
 * same circling arrows as the sync button, and the two were mistaken for one
 * another. Now it says what it fetches, and the "?" in its corner explains.
 */
test.describe('the button that fetches worlds from VRChat', () => {
  test('says it fetches favourites, and explains itself on "?"', async ({
    page,
  }) => {
    await page.goto(LIST_VIEW)
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })

    await expect(
      page.getByRole('button', {
        name: jaJP['fetch-favorites:button'],
        exact: true,
      }),
    ).toBeVisible()

    await page.getByTestId('fetch-favorites-help').click()
    const explanation = page.getByTestId('fetch-favorites-explanation')
    await expect(explanation).toBeVisible()
    await expect(
      explanation.getByText(jaJP['fetch-favorites:what-title']),
    ).toBeVisible()
    await page.getByRole('button', { name: jaJP['general:close'] }).click()
    await expect(explanation).toBeHidden()
  })

  test('says it fetches recently visited worlds on that page', async ({
    page,
  }) => {
    await page.goto(RECENTLY_VISITED)
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })

    await expect(
      page.getByRole('button', {
        name: jaJP['fetch-recent:button'],
        exact: true,
      }),
    ).toBeVisible()

    await page.getByTestId('fetch-recent-help').click()
    await expect(page.getByTestId('fetch-recent-explanation')).toBeVisible()
  })
})
