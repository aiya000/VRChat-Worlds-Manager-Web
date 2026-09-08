import { Context, Effect, Layer } from 'effect'
import {
  buildGoogleAuthUrl,
  type GoogleAuthIntent,
  isSafeReturnPath,
  parseGoogleAuthReturn,
} from '@/lib/google-auth-flow'
import { db } from './db'

/**
 * How a token is obtained: by leaving.
 *
 * The page navigates to Google's consent screen, and Google navigates back to
 * `/google-auth` with the token in the fragment (#104). No second window is
 * involved, which is the point: opened from the home screen, a popup became a
 * Chrome Custom Tab that could not hand its answer back, and the screen sat
 * on "syncing" until a timeout said so.
 *
 * Leaving means the page is gone, so what it was doing is written down first
 * (`PendingReturn`) and read back on `/google-auth`, which then goes to the
 * page that left and tells it what came of the trip (`GoogleAuthResume`).
 */

const CONNECTED_KEY = 'connected'

/** Local storage, not session: the trip may cross a Custom Tab boundary. */
const PENDING_RETURN_KEY = 'googleAuthPendingReturn'

/** Longer than anyone takes to pick an account; shorter than a forgotten tab. */
const PENDING_RETURN_TTL_MS = 10 * 60_000

/**
 * Taken off the hour Google grants, so a token is renewed before Drive would
 * have refused it mid-sync.
 */
const EXPIRY_MARGIN_MS = 60_000

/** The token itself, kept only in memory and only for as long as it is good. */
let currentAccessToken: { value: string; expiresAt: number } | null = null

interface PendingReturn {
  state: string
  intent: GoogleAuthIntent
  returnTo: string
  startedAt: number
}

/**
 * What the page that left is told when it is back.
 *
 * `denied` is the consent screen's "cancel" -- and every other refusal Google
 * sends in place of a token, since the page can do the same with each: say
 * so, and wait for the next press.
 */
export interface GoogleAuthResume {
  intent: GoogleAuthIntent
  outcome: 'granted' | 'denied'
}

/**
 * Held in a module variable across the client-side navigation from
 * `/google-auth` to the page that left. A reload on the way loses it, and
 * loses the token with it, so there is nothing to resume in that case anyway.
 */
let pendingResume: GoogleAuthResume | null = null

function usableAccessToken(): string | null {
  if (currentAccessToken === null) {
    return null
  }
  if (Date.now() >= currentAccessToken.expiresAt) {
    currentAccessToken = null
    return null
  }
  return currentAccessToken.value
}

function readPendingReturn(): PendingReturn | null {
  const raw = localStorage.getItem(PENDING_RETURN_KEY)
  if (raw === null) {
    return null
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') {
      return null
    }
    const record = parsed as Partial<PendingReturn>
    if (
      typeof record.state !== 'string' ||
      (record.intent !== 'connect' && record.intent !== 'sync') ||
      typeof record.returnTo !== 'string' ||
      typeof record.startedAt !== 'number'
    ) {
      return null
    }
    return record as PendingReturn
  } catch {
    return null
  }
}

function randomState(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Leaves for Google's consent screen. Nothing after this line runs: the
 * navigation replaces the page.
 *
 * `returnTo` is where `/google-auth` sends the browser afterwards, and it has
 * to be a page that knows how to pick the intent up -- see
 * `takeGoogleAuthResume`.
 */
function leaveForGoogle(intent: GoogleAuthIntent, returnTo: string): void {
  const state = randomState()
  const pending: PendingReturn = {
    state,
    intent,
    returnTo,
    startedAt: Date.now(),
  }
  localStorage.setItem(PENDING_RETURN_KEY, JSON.stringify(pending))
  window.location.assign(
    buildGoogleAuthUrl({ origin: window.location.origin, state }),
  )
}

/**
 * What `/google-auth` does with the fragment Google sent it back with.
 *
 * Returns the path to go on to, or `null` when there is nothing to go on
 * with: no trip was recorded, the `state` is not the one that was recorded
 * (someone else's link, or a stale tab), or the record is too old to trust.
 * In each of those the fragment is ignored, token and all.
 */
export async function completeGoogleAuthReturn(
  fragment: string,
): Promise<string | null> {
  const pending = readPendingReturn()
  localStorage.removeItem(PENDING_RETURN_KEY)
  if (
    pending === null ||
    Date.now() - pending.startedAt > PENDING_RETURN_TTL_MS ||
    !isSafeReturnPath(pending.returnTo)
  ) {
    return null
  }

  const returned = parseGoogleAuthReturn(fragment)
  if (returned.kind === 'nothing' || returned.state !== pending.state) {
    return null
  }

  if (returned.kind === 'denied') {
    pendingResume = { intent: pending.intent, outcome: 'denied' }
    return pending.returnTo
  }

  currentAccessToken = {
    value: returned.accessToken,
    expiresAt: Date.now() + returned.expiresInSeconds * 1000 - EXPIRY_MARGIN_MS,
  }
  // Whatever the trip was for, a token in hand means this device is connected.
  await db.googleAuthState.put({ key: CONNECTED_KEY, value: 'true' })
  pendingResume = { intent: pending.intent, outcome: 'granted' }
  return pending.returnTo
}

/**
 * Hands the outcome of the trip to the page that asked for it, once.
 *
 * Called from the mount effect of whichever component owns the button that
 * left. Only one of them gets it, which is right: the sync it resumes is the
 * same sync from either button, and `tryBeginSync` refuses a second.
 */
export function takeGoogleAuthResume(): GoogleAuthResume | null {
  const resume = pendingResume
  pendingResume = null
  return resume
}

/**
 * Thrown when the token in hand turned out to be too old to use.
 *
 * A new one is not fetched on the spot: Drive refused mid-sync, and leaving
 * for Google in the middle of reporting that would be a surprise. The caller
 * says so plainly, and the next press leaves for a fresh one.
 */
export class GoogleAuthExpiredError extends Error {}

export function forgetAccessToken(): void {
  currentAccessToken = null
}

/**
 * Either a token, or the page is already on its way to Google for one.
 * `redirecting` is a result rather than an error so the screen can keep its
 * "busy" state while the navigation takes effect, instead of resetting to an
 * idle button for the last frame before it disappears.
 */
export type AccessTokenOutcome =
  | { kind: 'token'; token: string }
  | { kind: 'redirecting' }

export type DriveConnectResult = { kind: 'connected' } | { kind: 'redirecting' }

export class GoogleAuthService extends Context.Tag('GoogleAuthService')<
  GoogleAuthService,
  {
    readonly isConnected: () => Effect.Effect<boolean, Error>
    readonly connect: (
      returnTo: string,
    ) => Effect.Effect<DriveConnectResult, Error>
    readonly disconnect: () => Effect.Effect<void, Error>
    readonly getAccessToken: (
      returnTo: string,
    ) => Effect.Effect<AccessTokenOutcome, Error>
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

  connect: (returnTo) =>
    Effect.tryPromise({
      try: async (): Promise<DriveConnectResult> => {
        if (usableAccessToken() !== null) {
          await db.googleAuthState.put({ key: CONNECTED_KEY, value: 'true' })
          return { kind: 'connected' }
        }
        leaveForGoogle('connect', returnTo)
        return { kind: 'redirecting' }
      },
      catch: (e) => new Error(`Failed to connect to Google Drive: ${e}`),
    }),

  getAccessToken: (returnTo) =>
    Effect.sync((): AccessTokenOutcome => {
      const token = usableAccessToken()
      if (token !== null) {
        return { kind: 'token', token }
      }
      leaveForGoogle('sync', returnTo)
      return { kind: 'redirecting' }
    }),

  /**
   * Clears this device's own record of being connected, and lets Google know
   * the token is done with when there is one to hand back. The grant itself
   * stays on Google's side either way; a user who wants it gone can remove it
   * from https://myaccount.google.com/permissions, same as with any other app.
   */
  disconnect: () =>
    Effect.tryPromise({
      try: async () => {
        const token = usableAccessToken()
        currentAccessToken = null
        await db.googleAuthState.delete(CONNECTED_KEY)

        if (token !== null) {
          // Best effort, and opaque: the endpoint does not answer CORS, so the
          // request goes out without a readable reply. A revocation that did
          // not land only leaves a token that expires within the hour anyway.
          await fetch('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token }),
          }).catch(() => {})
        }
      },
      catch: (e) => new Error(`Failed to disconnect from Google Drive: ${e}`),
    }),
})
