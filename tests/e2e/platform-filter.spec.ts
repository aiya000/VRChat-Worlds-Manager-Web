import { expect, test, type Page } from '@playwright/test'
import jaJP from '../../locales/ja-JP.json'
import { seedWorld } from './seed-world'

const LIST_VIEW = '/listview/folders/special/all'

const PC_WORLD = 'DesktopOnlyHall'
const CROSS_WORLD = 'CrossPlatformPlaza'
const UNKNOWN_WORLD = 'PlatformlessPlace'

test.use({ serviceWorkers: 'block' })

async function openTheFilters(page: Page) {
  await page.getByTestId('advanced-search-open').click()
  await expect(page.getByRole('dialog')).toContainText(
    jaJP['advanced-search:title'],
  )
}

async function toggle(page: Page, platform: string) {
  await page.locator(`#advanced-search-platform-${platform}`).click()
}

async function expectShown(page: Page, names: string[]) {
  for (const name of [PC_WORLD, CROSS_WORLD, UNKNOWN_WORLD]) {
    const world = page.getByText(name).first()
    if (names.includes(name)) {
      await expect(world).toBeVisible()
    } else {
      await expect(world).toBeHidden()
    }
  }
}

/**
 * The checkboxes ask for a world that supports all of what is ticked, which is
 * the opposite of how this kind of row usually reads, so each case here is one
 * the AND has to get right.
 */
test.describe('filtering the list by supported platform', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(LIST_VIEW)
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })
    await seedWorld(page, {
      worldId: 'wrld_platform_pc',
      name: PC_WORLD,
      platform: ['standalonewindows'],
    })
    await seedWorld(page, {
      worldId: 'wrld_platform_cross',
      name: CROSS_WORLD,
      platform: ['standalonewindows', 'android'],
    })
    await seedWorld(page, {
      worldId: 'wrld_platform_unknown',
      name: UNKNOWN_WORLD,
      platform: [],
    })
    await page.reload()
    await page.addStyleTag({
      content: 'nextjs-portal { display: none !important; }',
    })
    await expectShown(page, [PC_WORLD, CROSS_WORLD, UNKNOWN_WORLD])
  })

  test('shows everything while no box is ticked', async ({ page }) => {
    await openTheFilters(page)
    await page.keyboard.press('Escape')

    await expectShown(page, [PC_WORLD, CROSS_WORLD, UNKNOWN_WORLD])
  })

  test('keeps only the worlds that support the ticked platform', async ({
    page,
  }) => {
    await openTheFilters(page)
    await toggle(page, 'android')
    await page.keyboard.press('Escape')

    await expectShown(page, [CROSS_WORLD])
  })

  test('wants both when both are ticked, not either', async ({ page }) => {
    await openTheFilters(page)
    await toggle(page, 'android')
    await toggle(page, 'ios')
    await page.keyboard.press('Escape')

    await expectShown(page, [])
  })

  test('finds the world VRChat said nothing about under "unknown"', async ({
    page,
  }) => {
    await openTheFilters(page)
    await toggle(page, 'unknown')
    await page.keyboard.press('Escape')

    await expectShown(page, [UNKNOWN_WORLD])
  })

  test('brings everything back when the box is unticked again', async ({
    page,
  }) => {
    await openTheFilters(page)
    await toggle(page, 'android')
    await page.keyboard.press('Escape')
    await expectShown(page, [CROSS_WORLD])

    await openTheFilters(page)
    await toggle(page, 'android')
    await page.keyboard.press('Escape')

    await expectShown(page, [PC_WORLD, CROSS_WORLD, UNKNOWN_WORLD])
  })

  test('brings everything back through "clear all"', async ({ page }) => {
    await openTheFilters(page)
    await toggle(page, 'android')
    await page.getByRole('button', { name: jaJP['general:clear-all'] }).click()
    await page.keyboard.press('Escape')

    await expectShown(page, [PC_WORLD, CROSS_WORLD, UNKNOWN_WORLD])
  })
})
