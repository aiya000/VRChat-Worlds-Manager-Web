/**
 * Where Google Drive sync works, and where it does not.
 *
 * Brand verification for the OAuth consent screen rests on owning the domain
 * the app is served from, and a `pages.dev` subdomain can never be proven
 * that way (#107). So `pages.dev` was taken off the OAuth client's authorised
 * domains and only `vrcww.com` remains. The app is still served at
 * `pages.dev` -- installed PWAs and bookmarks still arrive there, and
 * everything but sync works -- but a trip to Google from there is refused
 * before any consent screen appears.
 *
 * Rather than let that refusal be the explanation, the app says so first,
 * and says where to go (#205). It does not redirect: a PWA installed from
 * `pages.dev` has its `start_url` there, and its data lives in that origin's
 * storage.
 */

/** The address Google is told about, and the one sync therefore works at. */
export const DRIVE_SYNC_HOME = 'https://vrcww.com/start'

/**
 * Whether Google will refuse to sign in from a page at this hostname.
 *
 * Only `pages.dev` is named: it is the one origin the app is knowingly still
 * served from without being registered. `localhost` is registered for
 * development, and anything else is not somewhere this app is served.
 */
export function isDriveSyncUnavailableAt(hostname: string): boolean {
  return hostname === 'pages.dev' || hostname.endsWith('.pages.dev')
}
