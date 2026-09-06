import { Context, Effect, Layer } from 'effect'
import { db } from './db'

/**
 * A public identifier, not a secret: it is meant to be embedded in code that
 * runs in the browser. Google tells apps apart by which origins are
 * registered against it, not by keeping this value hidden.
 */
const GOOGLE_CLIENT_ID =
  '673719548373-8q2i1u76gl4naso46hk2l4h63olsvfvt.apps.googleusercontent.com'

/**
 * `drive.file` rather than the broader Drive scopes: it only ever sees files
 * this app itself created, so a bug here cannot read anything else in
 * someone's Drive. See Issue #63 for why this was chosen over `drive.appdata`.
 */
const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

const CONNECTED_KEY = 'connected'

interface TokenClient {
  requestAccessToken: (overrides?: { prompt?: string }) => void
}

interface TokenResponse {
  access_token?: string
  error?: string
}

/**
 * What Google reports when the token was not granted -- the popup was closed,
 * or could not be opened at all. It arrives on a channel of its own:
 * `callback` above is only ever called on success.
 */
interface TokenError {
  type?: string
  message?: string
}

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string
            scope: string
            callback: (response: TokenResponse) => void
            error_callback?: (error: TokenError) => void
          }) => TokenClient
          revoke: (token: string, callback: () => void) => void
        }
      }
    }
  }
}

/**
 * How long to wait for Google before giving up on it.
 *
 * Not a guess at how slow Google is -- it is fast -- but a bound on the case
 * where the answer never comes back at all. Installed as a PWA, the consent
 * screen opens in a Chrome Custom Tab, a separate process that cannot always
 * reach back into the page that opened it; when that happens neither callback
 * ever fires, and without this the screen sits on "syncing" for as long as
 * someone is willing to watch it.
 */
const TOKEN_REQUEST_TIMEOUT_MS = 120_000

/**
 * The same bound, for a request nobody made.
 *
 * An automatic sync has no one watching it, so waiting two minutes buys
 * nothing: either Google answers from an existing grant straight away, or the
 * answer needed a window and there is no gesture to open one with.
 */
const BACKGROUND_TOKEN_TIMEOUT_MS = 15_000

/**
 * How long to leave background token requests alone after one failed.
 *
 * `prompt: ''` is meant to answer from the grant the user already gave,
 * without any UI. When it cannot -- the Google session is gone, the grant was
 * revoked -- it falls back to wanting a window, and a window opened outside a
 * click is refused by the browser. Retrying that on every poll would put a
 * blocked-popup indicator in front of someone once a minute for nothing.
 */
const BACKGROUND_RETRY_AFTER_MS = 600_000

/**
 * The access token itself, kept only in memory. It is good for about an hour
 * and nothing here is meant to outlive a reload -- reconnecting always asks
 * Google for a fresh one, so there is nothing worth persisting.
 */
let currentAccessToken: string | null = null

/** When a background request may next be made. See `BACKGROUND_RETRY_AFTER_MS`. */
let backgroundRetryAt = 0

let scriptLoadPromise: Promise<void> | null = null

function loadGisScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(
      new Error('Google Identity Services requires a browser'),
    )
  }
  if (window.google?.accounts.oauth2 !== undefined) {
    return Promise.resolve()
  }
  if (scriptLoadPromise === null) {
    scriptLoadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = GIS_SCRIPT_SRC
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        scriptLoadPromise = null
        reject(new Error('Failed to load Google Identity Services'))
      }
      document.head.appendChild(script)
    })
  }
  return scriptLoadPromise
}

/**
 * Loads the sign-in script ahead of time, without asking for a token.
 *
 * Google requires `requestAccessToken()` to be called synchronously from a
 * user gesture (a click), and awaiting the script tag's own load would break
 * that chain. Called once when the settings screen that offers "Connect"
 * mounts, so that by the time someone actually clicks it, there is nothing
 * left to await before asking.
 */
export function preloadGoogleIdentityScript(): void {
  loadGisScript().catch(() => {
    // Swallowed: `connect()` below surfaces the same failure to the caller,
    // and there is no user-visible action to take from a background preload.
  })
}

/** The consent window was closed, or the browser would not open it. */
export class GoogleAuthDismissedError extends Error {}

/**
 * The consent window opened but nothing ever came back from it.
 *
 * The case this exists for is being installed as a PWA, where the window is a
 * Chrome Custom Tab that may not be able to hand its answer back to the page.
 * Retrying in the browser rather than the installed app is what gets past it.
 */
export class GoogleAuthUnansweredError extends Error {}

/**
 * Asks Google for a token, straight away.
 *
 * Nothing may be awaited before `requestAccessToken()`: Google only honours it
 * inside the user gesture that led here, and an await hands the tick back.
 * `preloadGoogleIdentityScript` is what makes that possible, so a caller that
 * reaches this without the script already loaded gets an error rather than a
 * popup Google would block.
 */
function requestAccessToken(
  options: { prompt?: string; timeoutMs?: number } = {},
): Promise<string> {
  if (window.google?.accounts.oauth2 === undefined) {
    return Promise.reject(
      new Error('Google Identity Services has not finished loading'),
    )
  }

  return new Promise<string>((resolve, reject) => {
    let settled = false
    const finish = (outcome: () => void) => {
      if (settled) {
        return
      }
      settled = true
      clearTimeout(timer)
      outcome()
    }

    const timer = setTimeout(() => {
      finish(() =>
        reject(
          new GoogleAuthUnansweredError(
            'Google never answered the request for an access token',
          ),
        ),
      )
    }, options.timeoutMs ?? TOKEN_REQUEST_TIMEOUT_MS)

    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_FILE_SCOPE,
      callback: (response) => {
        finish(() => {
          if (
            response.error !== undefined ||
            response.access_token === undefined
          ) {
            reject(new Error(response.error ?? 'No access token was returned'))
            return
          }
          resolve(response.access_token)
        })
      },
      // Without this, a closed or blocked popup is silent: `callback` is not
      // called, and the promise above would never settle.
      error_callback: (error) => {
        finish(() =>
          reject(
            new GoogleAuthDismissedError(
              error.message ?? error.type ?? 'The Google window was closed',
            ),
          ),
        )
      },
    })
    client.requestAccessToken(
      options.prompt === undefined ? undefined : { prompt: options.prompt },
    )
  })
}

/**
 * Thrown when the token in hand turned out to be too old to use.
 *
 * A new one cannot be fetched on the spot: the gesture that would have
 * authorised it is long over by the time Drive answers. The caller's job is to
 * say so plainly and let the next press succeed, which is the one tap #63
 * decided to accept rather than putting a refresh token on a server.
 */
export class GoogleAuthExpiredError extends Error {}

export function forgetAccessToken(): void {
  currentAccessToken = null
}

export class GoogleAuthService extends Context.Tag('GoogleAuthService')<
  GoogleAuthService,
  {
    readonly isConnected: () => Effect.Effect<boolean, Error>
    readonly connect: () => Effect.Effect<void, Error>
    readonly disconnect: () => Effect.Effect<void, Error>
    /** Must be reached from inside a click, for the same reason `connect` must. */
    readonly getAccessToken: () => Effect.Effect<string, Error>
    /**
     * A token for a sync nobody pressed a button for.
     *
     * Fails with `GoogleAuthExpiredError` for every way of not getting one --
     * not connected, no longer signed in to Google, the grant withdrawn --
     * because the caller does the same thing in all of them: nothing, and
     * quietly. The button remains the way back.
     */
    readonly getAccessTokenInBackground: () => Effect.Effect<string, Error>
  }
>() {}

export const GoogleAuthServiceLive = Layer.succeed(GoogleAuthService, {
  isConnected: () =>
    Effect.tryPromise({
      try: async () => {
        const row = await db.googleAuthState.get(CONNECTED_KEY)
        return row?.value === 'true'
      },
      catch: (e) => new Error(`Failed to read connection state: ${e}`),
    }),

  connect: () =>
    Effect.tryPromise({
      try: async () => {
        await loadGisScript()
        currentAccessToken = await requestAccessToken()
        backgroundRetryAt = 0
        await db.googleAuthState.put({ key: CONNECTED_KEY, value: 'true' })
      },
      catch: (e) => new Error(`Failed to connect to Google Drive: ${e}`),
    }),

  getAccessToken: () =>
    Effect.tryPromise({
      try: async () => {
        if (currentAccessToken !== null) {
          return currentAccessToken
        }
        await loadGisScript()
        currentAccessToken = await requestAccessToken()
        // A press that worked says the grant is alive after all, so the
        // background path may start asking again straight away.
        backgroundRetryAt = 0
        return currentAccessToken
      },
      // Wrapping these would throw away the distinction the caller needs: the
      // screen says something different for a window that was closed than for
      // one that never answered.
      catch: (e) =>
        e instanceof GoogleAuthDismissedError ||
        e instanceof GoogleAuthUnansweredError
          ? e
          : new Error(`Failed to obtain a Google access token: ${e}`),
    }),

  getAccessTokenInBackground: () =>
    Effect.tryPromise({
      try: async () => {
        if (currentAccessToken !== null) {
          return currentAccessToken
        }

        const row = await db.googleAuthState.get(CONNECTED_KEY)
        if (row?.value !== 'true') {
          throw new GoogleAuthExpiredError(
            'This device is not connected to Google Drive',
          )
        }
        if (Date.now() < backgroundRetryAt) {
          throw new GoogleAuthExpiredError(
            'A background token request failed recently; waiting before asking again',
          )
        }

        await loadGisScript()
        try {
          // `prompt: ''` is the whole of automatic syncing: it answers from the
          // grant already given, without a window. When it cannot, it wants
          // one, and a window outside a click is refused -- which arrives here
          // as an error rather than as a popup someone has to dismiss.
          currentAccessToken = await requestAccessToken({
            prompt: '',
            timeoutMs: BACKGROUND_TOKEN_TIMEOUT_MS,
          })
        } catch (e) {
          backgroundRetryAt = Date.now() + BACKGROUND_RETRY_AFTER_MS
          throw e
        }
        return currentAccessToken
      },
      catch: (e) =>
        e instanceof GoogleAuthExpiredError
          ? e
          : new GoogleAuthExpiredError(
              `No Google access token could be had without asking: ${e}`,
            ),
    }),

  /**
   * Clears this device's own record of being connected. It does not reach
   * into Google's side of the grant: doing that needs the access token, and
   * one only exists in memory for as long as the tab that requested it stays
   * open. A user who wants the permission itself gone can remove it from
   * https://myaccount.google.com/permissions, same as with any other app.
   */
  disconnect: () =>
    Effect.tryPromise({
      try: async () => {
        const token = currentAccessToken
        currentAccessToken = null
        backgroundRetryAt = 0
        await db.googleAuthState.delete(CONNECTED_KEY)

        if (token !== null && window.google !== undefined) {
          await new Promise<void>((resolve) => {
            window.google!.accounts.oauth2.revoke(token, () => resolve())
          })
        }
      },
      catch: (e) => new Error(`Failed to disconnect from Google Drive: ${e}`),
    }),
})
