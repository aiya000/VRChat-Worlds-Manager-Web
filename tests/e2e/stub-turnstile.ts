import type { Page } from '@playwright/test'

/**
 * Stands in for Cloudflare's Turnstile script.
 *
 * The e2e dev server is built with a site key (`playwright.config.ts`), so a
 * sign-in asks for a challenge token before it goes out. The real script
 * would talk to Cloudflare; this one answers with a token of its own -- a
 * fresh one per challenge, since the Worker treats each as single-use -- or
 * with the error callback, which is what a failed challenge looks like.
 */
export async function stubTurnstile(
  page: Page,
  outcome: { passes: true } | { fails: string } = { passes: true },
): Promise<void> {
  const answer =
    'passes' in outcome
      ? `options.callback('dummy-token-' + window.__turnstileChallenges)`
      : `options['error-callback'](${JSON.stringify(outcome.fails)})`

  await page.route(
    'https://challenges.cloudflare.com/turnstile/v0/api.js**',
    async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          window.__turnstileChallenges = 0
          const widgets = new Map()
          window.turnstile = {
            render: (container, options) => {
              const id = 'widget-' + widgets.size
              widgets.set(id, options)
              return id
            },
            execute: (id) => {
              const options = widgets.get(id)
              window.__turnstileChallenges += 1
              // Asynchronous, as the real one is: a challenge never answers
              // inside the call that started it.
              setTimeout(() => { ${answer} }, 0)
            },
            remove: (id) => { widgets.delete(id) },
          }
        `,
      })
    },
  )
}

/** How many challenges the page has run since the script loaded. */
export async function turnstileChallenges(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as { __turnstileChallenges?: number })
        .__turnstileChallenges ?? 0,
  )
}
