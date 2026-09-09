/**
 * The pieces of the Google sign-in that do not touch the browser: the URL the
 * page leaves for, and what to make of the fragment it comes back with.
 *
 * Kept apart from the service so they can be tested without a window. The
 * flow itself -- leave the page, come back to `/google-auth` with the token in
 * the fragment -- is described in `google-auth-service.ts`.
 */

/**
 * A public identifier, not a secret: it is meant to be embedded in code that
 * runs in the browser. Google tells apps apart by which origins and redirect
 * URIs are registered against it, not by keeping this value hidden.
 */
export const GOOGLE_CLIENT_ID =
  '673719548373-8q2i1u76gl4naso46hk2l4h63olsvfvt.apps.googleusercontent.com'

/**
 * `drive.file` rather than the broader Drive scopes: it only ever sees files
 * this app itself created, so a bug here cannot read anything else in
 * someone's Drive. See Issue #63 for why this was chosen over `drive.appdata`.
 */
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

export const GOOGLE_AUTH_ENDPOINT =
  'https://accounts.google.com/o/oauth2/v2/auth'

/**
 * Where Google sends the browser back to, on every origin this app is served
 * from. It has to be registered, character for character, as an authorised
 * redirect URI of the OAuth client -- `https://<origin>/google-auth` for each
 * of production, `develop` and `http://localhost:3456`.
 */
export const GOOGLE_AUTH_RETURN_PATH = '/google-auth'

/**
 * Where the page that leaves writes down what it was doing.
 *
 * Local storage, not session: the trip may cross a Custom Tab boundary. The
 * key is here rather than in the service because giving a trip up (#159) has
 * to erase the same record the service writes, without pulling the database
 * in to do it.
 */
export const GOOGLE_AUTH_PENDING_RETURN_KEY = 'googleAuthPendingReturn'

/** What the page wanted a token for, so the return can carry on with it. */
export type GoogleAuthIntent = 'connect' | 'sync'

export function buildGoogleAuthUrl(input: {
  origin: string
  state: string
}): string {
  const url = new URL(GOOGLE_AUTH_ENDPOINT)
  url.searchParams.set('client_id', GOOGLE_CLIENT_ID)
  url.searchParams.set('redirect_uri', input.origin + GOOGLE_AUTH_RETURN_PATH)
  // The implicit flow: the token comes back in the fragment, which never
  // leaves the browser, and there is no server here to exchange a code on.
  url.searchParams.set('response_type', 'token')
  url.searchParams.set('scope', DRIVE_FILE_SCOPE)
  url.searchParams.set('state', input.state)
  url.searchParams.set('include_granted_scopes', 'true')
  return url.toString()
}

export type GoogleAuthReturn =
  | {
      kind: 'granted'
      accessToken: string
      expiresInSeconds: number
      state: string
    }
  | { kind: 'denied'; reason: string; state: string }
  | { kind: 'nothing' }

/**
 * Reads what Google put after the `#`.
 *
 * `expires_in` is optional in what Google documents, so a missing one is
 * taken as the hour a token is good for rather than as a token that never
 * expires.
 */
export function parseGoogleAuthReturn(fragment: string): GoogleAuthReturn {
  const params = new URLSearchParams(
    fragment.startsWith('#') ? fragment.slice(1) : fragment,
  )
  const state = params.get('state')
  if (state === null) {
    return { kind: 'nothing' }
  }
  const error = params.get('error')
  if (error !== null) {
    return { kind: 'denied', reason: error, state }
  }
  const accessToken = params.get('access_token')
  if (accessToken === null || accessToken === '') {
    return { kind: 'nothing' }
  }
  const expiresIn = Number(params.get('expires_in'))
  return {
    kind: 'granted',
    accessToken,
    expiresInSeconds:
      Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 3600,
    state,
  }
}

/**
 * Whether a path recorded before leaving is one this app may come back to.
 *
 * Only ever written by this app, but a value read back from storage is still
 * checked: `//evil.example` would be an open redirect if it got as far as the
 * router.
 */
export function isSafeReturnPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\')
}
