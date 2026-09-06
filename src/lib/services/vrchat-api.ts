import { Context, Effect, Layer } from 'effect'
import { launchTargetFor, type LaunchOutcome } from '@/lib/launch-target'
import { instanceRequestBody, parseInstanceInfo } from '@/lib/vrchat-instances'
import type { InstanceType } from '@/types/instances'
import { db } from './db'
import { parseVRChatWorld, toWorldDisplayData } from './vrchat-world'
import type {
  WorldDetails,
  WorldDisplayData,
  InstanceInfo,
  InstanceRegion,
  UserGroup,
  GroupInstancePermissionInfo,
  Platform,
} from '@/lib/types'

// `localStorage` override lets a developer point the app at a locally-run
// `wrangler dev` worker; production/preview deployments fall back to the
// worker URL baked in at build time via `NEXT_PUBLIC_CF_WORKER_URL`.
const CF_WORKER_URL =
  (typeof window !== 'undefined'
    ? localStorage.getItem('cf_worker_url')
    : null) ??
  process.env.NEXT_PUBLIC_CF_WORKER_URL ??
  ''

const CF_ACCESS_CLIENT_ID = process.env.NEXT_PUBLIC_CF_ACCESS_CLIENT_ID ?? ''
const CF_ACCESS_CLIENT_SECRET =
  process.env.NEXT_PUBLIC_CF_ACCESS_CLIENT_SECRET ?? ''

// The frontend and the Worker are served from different registrable domains
// (`*.pages.dev` vs `*.workers.dev`), so the session cookies VRChat issues are
// cross-site for the browser and never sent back. The Worker therefore hands
// them over as plain headers, and we replay them on every subsequent request.
const AUTH_TOKEN_HEADER = 'X-VRC-Auth'
const TWO_FACTOR_TOKEN_HEADER = 'X-VRC-Two-Factor-Auth'
const AUTH_TOKEN_KEY = 'auth_cookie'
const TWO_FACTOR_TOKEN_KEY = 'two_factor_auth_cookie'

const tokenCache = new Map<string, string>()

async function loadToken(key: string): Promise<string | null> {
  const cached = tokenCache.get(key)
  if (cached !== undefined) {
    return cached
  }
  try {
    const record = await db.authState.get(key)
    if (record === undefined) {
      return null
    }
    tokenCache.set(key, record.value)
    return record.value
  } catch {
    // IndexedDB is unavailable while prerendering and in unit tests; the
    // in-memory cache alone still carries the session for this page load.
    return null
  }
}

async function saveToken(key: string, value: string): Promise<void> {
  tokenCache.set(key, value)
  try {
    await db.authState.put({ key, value })
  } catch {
    // See loadToken(): persistence is best-effort.
  }
}

async function clearTokens(): Promise<void> {
  tokenCache.clear()
  try {
    await db.authState.clear()
  } catch {
    // See loadToken(): persistence is best-effort.
  }
}

async function storeIssuedTokens(res: Response): Promise<void> {
  const issuedAuth = res.headers.get(AUTH_TOKEN_HEADER)
  if (issuedAuth !== null && issuedAuth !== '') {
    await saveToken(AUTH_TOKEN_KEY, issuedAuth)
  }
  const issuedTwoFactor = res.headers.get(TWO_FACTOR_TOKEN_HEADER)
  if (issuedTwoFactor !== null && issuedTwoFactor !== '') {
    await saveToken(TWO_FACTOR_TOKEN_KEY, issuedTwoFactor)
  }
}

export const TWO_FACTOR_REQUIRED_ERROR = '2fa-required'
export const EMAIL_TWO_FACTOR_REQUIRED_ERROR = 'email-2fa-required'

/**
 * VRChat answers a login against a 2FA-protected account with HTTP 200 and a
 * `requiresTwoFactorAuth` body rather than an error status, so the body -- not
 * the status -- decides whether the login actually completed.
 */
export function twoFactorRequirementOf(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null
  }
  const methods = (body as { requiresTwoFactorAuth?: unknown })
    .requiresTwoFactorAuth
  if (!Array.isArray(methods)) {
    return null
  }
  const normalized = methods
    .filter((method): method is string => typeof method === 'string')
    .map((method) => method.toLowerCase())
  if (normalized.length === 0) {
    return null
  }
  return normalized.includes('emailotp')
    ? EMAIL_TWO_FACTOR_REQUIRED_ERROR
    : TWO_FACTOR_REQUIRED_ERROR
}

// Callers hand over VRChat's own spelling (`emailOtp`), which does not match
// the lowercase endpoint segment, so compare case-insensitively.
export function twoFactorVerifyPath(twoFactorType: string): string {
  switch (twoFactorType.toLowerCase()) {
    case 'totp':
      return '/auth/twofactorauth/totp/verify'
    case 'emailotp':
      return '/auth/twofactorauth/emailotp/verify'
    default:
      return '/auth/twofactorauth/otp/verify'
  }
}

// Carries the UI-facing error code that the login screens match on, so the
// generic `Login failed: ...` wrapping must not swallow it.
class TwoFactorRequiredError extends Error {}

/**
 * Keeps the status alongside the message so a caller can tell a rejected input
 * apart from a broken request without parsing the text back out.
 */
export class VRChatApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`API error ${status}: ${body}`)
  }
}

export const INVALID_TWO_FACTOR_CODE_ERROR = 'invalid-2fa-code'

class InvalidTwoFactorCodeError extends Error {}

function apiUrl(path: string): string {
  return `${CF_WORKER_URL}/api/1${path}`
}

/**
 * The `Basic` credential VRChat expects: each half percent-encoded first, then
 * the pair base64-encoded.
 *
 * VRChat's API documents the percent-encoding, and it is also what makes this
 * work at all for a name outside Latin-1 -- `btoa` throws
 * `InvalidCharacterError` on such a string, so a Japanese username failed
 * before the request was ever sent.
 */
export function basicAuthCredential(
  username: string,
  password: string,
): string {
  return btoa(`${encodeURIComponent(username)}:${encodeURIComponent(password)}`)
}

async function apiFetch(
  path: string,
  options?: RequestInit,
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  }
  if (CF_ACCESS_CLIENT_ID) {
    headers['CF-Access-Client-Id'] = CF_ACCESS_CLIENT_ID
  }
  if (CF_ACCESS_CLIENT_SECRET) {
    headers['CF-Access-Client-Secret'] = CF_ACCESS_CLIENT_SECRET
  }

  const authToken = await loadToken(AUTH_TOKEN_KEY)
  if (authToken !== null && authToken !== '') {
    headers[AUTH_TOKEN_HEADER] = authToken
  }
  const twoFactorToken = await loadToken(TWO_FACTOR_TOKEN_KEY)
  if (twoFactorToken !== null && twoFactorToken !== '') {
    headers[TWO_FACTOR_TOKEN_HEADER] = twoFactorToken
  }

  const res = await fetch(apiUrl(path), {
    ...options,
    credentials: 'include',
    headers,
  })
  await storeIssuedTokens(res)
  if (!res.ok) {
    const text = await res.text()
    throw new VRChatApiError(res.status, text)
  }
  return res
}

export class VRChatApiService extends Context.Tag('VRChatApiService')<
  VRChatApiService,
  {
    readonly tryLogin: () => Effect.Effect<void, Error>
    readonly loginWithCredentials: (
      username: string,
      password: string,
    ) => Effect.Effect<void, Error>
    readonly loginWith2fa: (
      code: string,
      twoFactorType: string,
    ) => Effect.Effect<void, Error>
    readonly logout: () => Effect.Effect<void, Error>
    readonly getFavoriteWorlds: (
      onProgress?: (fetched: number) => void,
    ) => Effect.Effect<WorldDisplayData[], Error>
    readonly purgeAllFavoriteWorlds: (
      onProgress?: (done: number, total: number) => void,
    ) => Effect.Effect<{ deleted: number; failed: number }, Error>
    readonly getCurrentUser: () => Effect.Effect<
      { id: string; displayName: string },
      Error
    >
    readonly getWorld: (worldId: string) => Effect.Effect<WorldDetails, Error>
    readonly checkWorldInfo: (
      worldId: string,
    ) => Effect.Effect<WorldDetails, Error>
    readonly getRecentlyVisitedWorlds: () => Effect.Effect<
      WorldDisplayData[],
      Error
    >
    readonly searchWorlds: (
      sort: string,
      tags: string[],
      excludeTags: string[],
      search: string,
      page: number,
    ) => Effect.Effect<WorldDisplayData[], Error>
    readonly createWorldInstance: (
      worldId: string,
      instanceType: Exclude<InstanceType, 'group'>,
      region: InstanceRegion,
    ) => Effect.Effect<InstanceInfo, Error>
    readonly getUserGroups: () => Effect.Effect<UserGroup[], Error>
    readonly getPermissionForCreateGroupInstance: (
      groupId: string,
    ) => Effect.Effect<GroupInstancePermissionInfo, Error>
    readonly createGroupInstance: (
      worldId: string,
      groupId: string,
      instanceTypeStr: string,
      allowedRoles: string[] | null,
      regionStr: string,
      queueEnabled: boolean,
    ) => Effect.Effect<InstanceInfo, Error>
    readonly openInstanceInClient: (
      worldId: string,
      instanceId: string,
      platforms: Platform[] | null,
    ) => Effect.Effect<LaunchOutcome, Error>
  }
>() {}

export const VRChatApiServiceLive = Layer.succeed(VRChatApiService, {
  tryLogin: () =>
    Effect.tryPromise({
      try: async () => {
        const res = await apiFetch('/auth/user')
        // A session still awaiting its second factor also answers 200 here,
        // and every other endpoint rejects it as `Missing Credentials`.
        if (twoFactorRequirementOf(await res.json()) !== null) {
          throw new Error('Two-factor authentication is not verified')
        }
      },
      catch: (e) => new Error(`Login check failed: ${e}`),
    }),

  loginWithCredentials: (username, password) =>
    Effect.tryPromise({
      try: async () => {
        await clearTokens()
        const res = await apiFetch('/auth/user', {
          headers: {
            Authorization: `Basic ${basicAuthCredential(username, password)}`,
          },
        })
        const requirement = twoFactorRequirementOf(await res.json())
        if (requirement !== null) {
          throw new TwoFactorRequiredError(requirement)
        }
      },
      catch: (e) =>
        e instanceof TwoFactorRequiredError
          ? e
          : new Error(`Login failed: ${e}`),
    }),

  loginWith2fa: (code, twoFactorType) =>
    Effect.tryPromise({
      try: async () => {
        const res = await apiFetch(twoFactorVerifyPath(twoFactorType), {
          method: 'POST',
          body: JSON.stringify({ code }),
        })
        const body = (await res.json()) as { verified?: boolean }
        if (body.verified === false) {
          throw new InvalidTwoFactorCodeError(INVALID_TWO_FACTOR_CODE_ERROR)
        }
      },
      // A wrong code comes back as 400 with `{"verified":false}` rather than as
      // a 200 body, so both shapes have to end up as the same reported cause --
      // otherwise the raw API text is what the person reads.
      catch: (e) => {
        if (e instanceof InvalidTwoFactorCodeError) {
          return e
        }
        if (e instanceof VRChatApiError && e.status === 400) {
          return new Error(INVALID_TWO_FACTOR_CODE_ERROR)
        }
        return new Error(`2FA failed: ${e}`)
      },
    }),

  logout: () =>
    Effect.tryPromise({
      try: async () => {
        try {
          await apiFetch('/logout', { method: 'PUT' })
        } finally {
          await clearTokens()
        }
      },
      catch: (e) => new Error(`Logout failed: ${e}`),
    }),

  // `/worlds/favorites` returns the favorited worlds themselves, so one request
  // per page is enough. Walking `/favorites` and fetching each world instead
  // would cost one request per favorite and quickly hit the Worker's hourly
  // per-IP limit for anyone with a few hundred favorites.
  getFavoriteWorlds: (onProgress) =>
    Effect.tryPromise({
      try: async () => {
        const PAGE_SIZE = 100
        const worlds: WorldDisplayData[] = []
        const fetchedAt = new Date().toISOString()
        let offset = 0
        for (;;) {
          const res = await apiFetch(
            `/worlds/favorites?n=${PAGE_SIZE}&offset=${offset}`,
          )
          const page = (await res.json()) as unknown[]
          for (const raw of page) {
            worlds.push(
              toWorldDisplayData(parseVRChatWorld(raw), fetchedAt, []),
            )
          }
          onProgress?.(worlds.length)
          if (page.length < PAGE_SIZE) {
            break
          }
          offset += PAGE_SIZE
        }
        return worlds
      },
      catch: (e) => new Error(`Failed to get favorites: ${e}`),
    }),

  // Deletes every "world" favorite on the real, authenticated VRChat account.
  // This is irreversible on VRChat's side; callers must gate this behind an
  // explicit user confirmation (see purge-vrchat-favorites-dialog.tsx).
  purgeAllFavoriteWorlds: (onProgress) =>
    Effect.tryPromise({
      try: async () => {
        const PAGE_SIZE = 100
        const favoriteIds: string[] = []
        let offset = 0
        for (;;) {
          const res = await apiFetch(
            `/favorites?type=world&n=${PAGE_SIZE}&offset=${offset}`,
          )
          const page = (await res.json()) as Array<{ id: string }>
          favoriteIds.push(...page.map((f) => f.id))
          if (page.length < PAGE_SIZE) {
            break
          }
          offset += PAGE_SIZE
        }

        let deleted = 0
        let failed = 0
        const total = favoriteIds.length
        onProgress?.(0, total)
        for (const favoriteId of favoriteIds) {
          try {
            await apiFetch(`/favorites/${favoriteId}`, { method: 'DELETE' })
            deleted += 1
          } catch (e) {
            console.error(`Failed to delete favorite ${favoriteId}: ${e}`)
            failed += 1
          }
          onProgress?.(deleted + failed, total)
        }

        return { deleted, failed }
      },
      catch: (e) => new Error(`Failed to purge favorites: ${e}`),
    }),

  getCurrentUser: () =>
    Effect.tryPromise({
      try: async () => {
        const res = await apiFetch('/auth/user')
        const user = (await res.json()) as {
          id: string
          displayName: string
        }
        return { id: user.id, displayName: user.displayName }
      },
      catch: (e) => new Error(`Failed to get current user: ${e}`),
    }),

  getWorld: (worldId) =>
    Effect.tryPromise({
      try: async () => {
        const res = await apiFetch(`/worlds/${worldId}`)
        return parseVRChatWorld(await res.json())
      },
      catch: (e) => new Error(`Failed to get world: ${e}`),
    }),

  checkWorldInfo: (worldId) =>
    Effect.tryPromise({
      try: async () => {
        const res = await apiFetch(`/worlds/${worldId}`)
        return parseVRChatWorld(await res.json())
      },
      catch: (e) => new Error(`Failed to check world: ${e}`),
    }),

  getRecentlyVisitedWorlds: () =>
    Effect.tryPromise({
      try: async () => {
        const res = await apiFetch(
          '/worlds?sort=updated&user=me&releaseStatus=public&n=100',
        )
        const fetchedAt = new Date().toISOString()
        return ((await res.json()) as unknown[]).map((raw) =>
          toWorldDisplayData(parseVRChatWorld(raw), fetchedAt, []),
        )
      },
      catch: (e) => new Error(`Failed to get recent worlds: ${e}`),
    }),

  searchWorlds: (sort, tags, excludeTags, search, page) =>
    Effect.tryPromise({
      try: async () => {
        const params = new URLSearchParams({
          sort,
          n: '50',
          offset: String(page * 50),
        })
        if (search) {
          params.set('search', search)
        }
        if (tags.length > 0) {
          params.set('tag', tags.join(','))
        }
        if (excludeTags.length > 0) {
          params.set('notag', excludeTags.join(','))
        }
        const res = await apiFetch(`/worlds?${params.toString()}`)
        const fetchedAt = new Date().toISOString()
        return ((await res.json()) as unknown[]).map((raw) =>
          toWorldDisplayData(parseVRChatWorld(raw), fetchedAt, []),
        )
      },
      catch: (e) => new Error(`Failed to search worlds: ${e}`),
    }),

  createWorldInstance: (worldId, instanceType, region) =>
    Effect.tryPromise({
      try: async () => {
        // Every type but public is owned by someone, and the API asks who.
        const userRes = await apiFetch('/auth/user')
        const user = (await userRes.json()) as { id: string }
        const res = await apiFetch('/instances', {
          method: 'POST',
          body: JSON.stringify(
            instanceRequestBody(worldId, instanceType, region, user.id),
          ),
        })
        return parseInstanceInfo(await res.json())
      },
      catch: (e) => new Error(`Failed to create instance: ${e}`),
    }),

  getUserGroups: () =>
    Effect.tryPromise({
      try: async () => {
        const userRes = await apiFetch('/auth/user')
        const user = (await userRes.json()) as { id: string }
        const res = await apiFetch(`/users/${user.id}/groups`)
        return (await res.json()) as UserGroup[]
      },
      catch: (e) => new Error(`Failed to get groups: ${e}`),
    }),

  getPermissionForCreateGroupInstance: (groupId) =>
    Effect.tryPromise({
      try: async () => {
        const res = await apiFetch(`/groups/${groupId}/instances/permissions`)
        return (await res.json()) as GroupInstancePermissionInfo
      },
      catch: (e) => new Error(`Failed to get permissions: ${e}`),
    }),

  createGroupInstance: (
    worldId,
    groupId,
    instanceTypeStr,
    allowedRoles,
    regionStr,
    queueEnabled,
  ) =>
    Effect.tryPromise({
      try: async () => {
        const res = await apiFetch('/instances', {
          method: 'POST',
          body: JSON.stringify({
            worldId,
            type: instanceTypeStr,
            region: regionStr,
            groupAccessType: instanceTypeStr,
            ownerId: groupId,
            roleIds: allowedRoles,
            queueEnabled,
          }),
        })
        return parseInstanceInfo(await res.json())
      },
      catch: (e) => new Error(`Failed to create group instance: ${e}`),
    }),

  openInstanceInClient: (worldId, instanceId, platforms) =>
    Effect.tryPromise({
      try: async () => {
        const target = launchTargetFor({
          worldId,
          instanceId,
          userAgent: navigator.userAgent,
          platforms,
        })
        switch (target.kind) {
          case 'client':
            window.open(target.url, '_blank')
            return { kind: 'client' }
          case 'android-app': {
            // In place, not a new tab: the intent has to be navigated to from
            // the document that was pressed, or Chrome has no gesture to open
            // an app with. `_self` rather than `location.assign` so a test can
            // stand in for it the same way it does for the case above.
            window.open(target.url, '_self')
            // The same invite the website's "Invite Me" sends. The app shows
            // it as a notification, which is a way in that does not depend on
            // the intent above having been taken.
            const invited = await apiFetch(
              `/invite/myself/to/${worldId}:${instanceId}`,
              { method: 'POST' },
            ).then(
              () => true,
              (e) => {
                console.error(`Failed to invite myself: ${e}`)
                return false
              },
            )
            return { kind: 'android-app', invited }
          }
          case 'not-on-android':
            return target
        }
      },
      catch: (e) => new Error(`Failed to open instance: ${e}`),
    }),
})
