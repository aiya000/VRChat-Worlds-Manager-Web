import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedWorld } from './seed-world'

const LIST_VIEW = '/listview/folders/special/all'

const PHONE = { width: 390, height: 844 }

const SEARCH_PLACEHOLDER = jaJP['world-grid:search-placeholder']

const searchInput = (page: Page) => page.getByPlaceholder(SEARCH_PLACEHOLDER)
const clearButton = (page: Page) => page.getByTestId('search-clear')

async function openListView(page: Page) {
  await page.setViewportSize(PHONE)
  await page.goto(LIST_VIEW)
  // Next's dev overlay sits over the page and swallows clicks meant for it.
  await page.addStyleTag({
    content: 'nextjs-portal { display: none !important; }',
  })
  await expect(page.locator('[data-sidebar="trigger"]')).toBeVisible()
}

test.describe('the search field clear button', () => {
  test('appears only once something has been typed', async ({ page }) => {
    await openListView(page)

    await expect(clearButton(page)).toHaveCount(0)

    await searchInput(page).fill('あああ')
    await expect(clearButton(page)).toBeVisible()
  })

  // What the press is for: a search that matches nothing leaves an empty grid,
  // and the field is the only thing standing between the user and their worlds.
  test('empties the field and brings the whole list back', async ({ page }) => {
    await openListView(page)
    await seedWorld(page, { worldId: 'wrld_clear', name: 'Seeded World' })
    await page.reload()
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })

    const world = page.getByText('Seeded World')
    await expect(world).toBeVisible()

    await searchInput(page).fill('あああ')
    await expect(world).toHaveCount(0)

    await clearButton(page).click()

    await expect(searchInput(page)).toHaveValue('')
    await expect(clearButton(page)).toHaveCount(0)
    await expect(world).toBeVisible()
  })

  // Both buttons sit inside the field, and the advanced-search one was there
  // first: if the clear button overlapped it, the press would open the panel
  // instead of clearing, and neither may cover the text being typed.
  test('sits beside the advanced-search button without covering the text', async ({
    page,
  }) => {
    await openListView(page)
    await searchInput(page).fill('あああ')

    const clear = await clearButton(page).boundingBox()
    const advanced = await page
      .getByTestId('advanced-search-open')
      .boundingBox()
    const input = await searchInput(page).boundingBox()

    expect(clear).not.toBe(null)
    expect(advanced).not.toBe(null)
    expect(input).not.toBe(null)

    expect(clear!.x + clear!.width).toBeLessThanOrEqual(advanced!.x + 1)
    expect(advanced!.x + advanced!.width).toBeLessThanOrEqual(
      input!.x + input!.width + 1,
    )

    // A VR controller aims a laser; a small hit target is effectively unusable.
    expect(clear!.width).toBeGreaterThanOrEqual(32)
    expect(clear!.height).toBeGreaterThanOrEqual(32)

    const textRight = await searchInput(page).evaluate((element) => {
      const input = element as HTMLInputElement
      const style = getComputedStyle(input)
      return (
        input.getBoundingClientRect().right - parseFloat(style.paddingRight)
      )
    })
    expect(textRight).toBeLessThanOrEqual(clear!.x + 1)
  })
})
