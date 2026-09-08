import type { Page } from '@playwright/test'

/**
 * Stands in for Google's consent screen.
 *
 * The app leaves the page for `accounts.google.com/o/oauth2/v2/auth` and
 * expects to be sent back to its own `/google-auth` with the answer in the
 * fragment (#104). A real Google account and a real consent screen are out of
 * reach here, so the navigation is answered with that redirect straight
 * away, `state` echoed back the way Google echoes it.
 *
 * Returns a counter of how many times the page left for Google -- "a sync
 * went to Google when nobody pressed anything" is a thing a test has to be
 * able to see, and the navigation is what would have shown it.
 */
export async function stubGoogleAuth(
  page: Page,
  outcome:
    | { token: string }
    // What Google sends in place of a token: `access_denied` when the consent
    // screen is cancelled, and the rest of its error codes the same way.
    | { denied: string },
): Promise<{ trips: () => number }> {
  let trips = 0

  await page.route(
    'https://accounts.google.com/o/oauth2/v2/auth**',
    async (route) => {
      trips += 1
      const asked = new URL(route.request().url())
      const redirectUri = asked.searchParams.get('redirect_uri')
      const state = asked.searchParams.get('state')
      if (redirectUri === null || state === null) {
        await route.abort()
        return
      }
      const fragment = new URLSearchParams(
        'token' in outcome
          ? {
              access_token: outcome.token,
              token_type: 'Bearer',
              expires_in: '3599',
              scope: asked.searchParams.get('scope') ?? '',
              state,
            }
          : { error: outcome.denied, state },
      )
      await route.fulfill({
        status: 302,
        headers: { location: `${redirectUri}#${fragment.toString()}` },
      })
    },
  )

  return { trips: () => trips }
}
