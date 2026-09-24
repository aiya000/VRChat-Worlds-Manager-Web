import { describe, expect, it } from 'vitest'

import {
  buildProxyHeaders,
  buildVRChatCookieHeader,
  countAgainst,
  DEFAULT_LIMITS,
  isCredentialAttempt,
  isOriginAllowed,
  isRefusedBy,
  isRouteAllowed,
  parseSetCookieValue,
  readLimits,
  secondsUntilUtcMidnight,
  type Env,
} from './index'
import { countUse, nextUtcMidnight } from './usage-counter'

describe('isRouteAllowed', () => {
  it('lets a self-invite through, instance id and all', () => {
    expect(
      isRouteAllowed(
        'POST',
        '/invite/myself/to/wrld_1234:12345~private(usr_me)~region(jp)',
      ),
    ).toBe(true)
  })

  it('does not let the self-invite path reach anything further down', () => {
    expect(isRouteAllowed('POST', '/invite/myself/to/wrld_1:1/response')).toBe(
      false,
    )
    expect(isRouteAllowed('GET', '/invite/myself/to/wrld_1:1')).toBe(false)
  })

  it('still refuses what the app never asks for', () => {
    expect(isRouteAllowed('POST', '/invite/usr_someone')).toBe(false)
    expect(isRouteAllowed('DELETE', '/instances')).toBe(false)
  })

  it('does not let a traversal segment pass as an approved route', () => {
    // `[^/]+` matches `..`, so these read as approved routes and then became
    // a different path when the target URL was parsed.
    expect(isRouteAllowed('GET', '/worlds/..')).toBe(false)
    expect(isRouteAllowed('GET', '/worlds/.')).toBe(false)
    expect(isRouteAllowed('GET', '/worlds/%2e%2e')).toBe(false)
    expect(isRouteAllowed('GET', '/worlds/%2E%2E')).toBe(false)
  })

  it('leaves a world id that merely contains dots alone', () => {
    expect(isRouteAllowed('GET', '/worlds/wrld_1.2.3')).toBe(true)
  })

  // The visit history rides the world-by-id pattern. A Worker change cannot be
  // tried anywhere but production, so this is asserted here rather than found
  // out at the next release.
  it('lets the recently visited worlds through', () => {
    expect(isRouteAllowed('GET', '/worlds/recent')).toBe(true)
  })
})

describe('isCredentialAttempt', () => {
  it('counts a sign-in, which is the one `GET /auth/user` that carries Basic', () => {
    expect(isCredentialAttempt('GET', '/auth/user', 'Basic dXNlcjpwYXNz')).toBe(
      true,
    )
  })

  it('does not count the "who am I?" every page load makes', () => {
    expect(isCredentialAttempt('GET', '/auth/user', null)).toBe(false)
  })

  it('counts a two-factor guess, which is only six digits wide', () => {
    expect(
      isCredentialAttempt('POST', '/auth/twofactorauth/totp/verify', null),
    ).toBe(true)
    expect(
      isCredentialAttempt('POST', '/auth/twofactorauth/emailotp/verify', null),
    ).toBe(true)
  })

  it('leaves ordinary requests out of the sign-in allowance', () => {
    expect(isCredentialAttempt('GET', '/worlds/wrld_1', null)).toBe(false)
    expect(isCredentialAttempt('PUT', '/logout', 'Basic dXNlcjpwYXNz')).toBe(
      false,
    )
  })
})

describe('buildProxyHeaders', () => {
  it('carries what VRChat needs, and rebuilds the cookie itself', () => {
    const headers = buildProxyHeaders(
      new Headers({
        Authorization: 'Basic dXNlcjpwYXNz',
        'Content-Type': 'application/json',
        'User-Agent': 'VRChatWorldsManagerWeb/1.0',
      }),
      'auth=authcookie_abc',
    )

    expect(headers.get('Authorization')).toBe('Basic dXNlcjpwYXNz')
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('User-Agent')).toBe('VRChatWorldsManagerWeb/1.0')
    expect(headers.get('Cookie')).toBe('auth=authcookie_abc')
  })

  it('does not carry a header the caller made up', () => {
    // Everything the caller sent used to be forwarded, so this Worker would
    // put any header at all in front of VRChat on a stranger's behalf.
    const headers = buildProxyHeaders(
      new Headers({
        'X-Forwarded-For': '10.0.0.1',
        'X-Made-Up': 'whatever',
        Host: 'api.vrchat.cloud',
        Origin: 'https://example.com',
      }),
      null,
    )

    expect(headers.get('X-Forwarded-For')).toBe(null)
    expect(headers.get('X-Made-Up')).toBe(null)
    expect(headers.get('Origin')).toBe(null)
  })

  it('never takes a cookie from the request itself', () => {
    // The session is held as headers and rebuilt here; a `Cookie` the caller
    // sent is not the app's session and has no business upstream.
    const headers = buildProxyHeaders(
      new Headers({ Cookie: 'auth=someone_elses' }),
      null,
    )
    expect(headers.get('Cookie')).toBe(null)
  })
})

describe('isOriginAllowed', () => {
  it('allows the exact configured origin', () => {
    expect(
      isOriginAllowed(
        'https://vrchat-worlds-manager-web.pages.dev',
        'https://vrchat-worlds-manager-web.pages.dev',
      ),
    ).toBe(true)
  })

  it('allows any Cloudflare Pages preview subdomain of the configured project', () => {
    expect(
      isOriginAllowed(
        'https://feature-web.vrchat-worlds-manager-web.pages.dev',
        'https://vrchat-worlds-manager-web.pages.dev',
      ),
    ).toBe(true)

    expect(
      isOriginAllowed(
        'https://some-other-branch.vrchat-worlds-manager-web.pages.dev',
        'https://vrchat-worlds-manager-web.pages.dev',
      ),
    ).toBe(true)
  })

  it('rejects a different project even if the hostname contains the allowed one', () => {
    expect(
      isOriginAllowed(
        'https://evilvrchat-worlds-manager-web.pages.dev',
        'https://vrchat-worlds-manager-web.pages.dev',
      ),
    ).toBe(false)
  })

  it('rejects an unrelated .pages.dev project', () => {
    expect(
      isOriginAllowed(
        'https://some-attacker-project.pages.dev',
        'https://vrchat-worlds-manager-web.pages.dev',
      ),
    ).toBe(false)
  })

  it('rejects a scheme downgrade to http', () => {
    expect(
      isOriginAllowed(
        'http://feature-web.vrchat-worlds-manager-web.pages.dev',
        'https://vrchat-worlds-manager-web.pages.dev',
      ),
    ).toBe(false)
  })

  it('does not auto-allow subdomains when the configured origin is a custom domain', () => {
    expect(
      isOriginAllowed(
        'https://evil.vrchat-worlds-manager.app',
        'https://vrchat-worlds-manager.app',
      ),
    ).toBe(false)
  })

  it('allows everything when configured as a wildcard', () => {
    expect(isOriginAllowed('https://anything.example.com', '*')).toBe(true)
  })

  /**
   * The app answers at its own domain and at the `pages.dev` one it was
   * reached at before that domain existed, so the setting is a list.
   */
  describe('with several origins configured', () => {
    const CONFIGURED =
      'https://vrcww.com,https://develop.vrcww.com,https://vrchat-worlds-manager-web.pages.dev'

    it('allows each one that is listed', () => {
      expect(isOriginAllowed('https://vrcww.com', CONFIGURED)).toBe(true)
      expect(isOriginAllowed('https://develop.vrcww.com', CONFIGURED)).toBe(
        true,
      )
      expect(
        isOriginAllowed(
          'https://vrchat-worlds-manager-web.pages.dev',
          CONFIGURED,
        ),
      ).toBe(true)
    })

    it('still allows a Pages preview subdomain of the listed project', () => {
      expect(
        isOriginAllowed(
          'https://feature-web.vrchat-worlds-manager-web.pages.dev',
          CONFIGURED,
        ),
      ).toBe(true)
    })

    // The reason `develop.vrcww.com` is listed by name rather than reached by
    // a rule: owning the domain is not a statement about every subdomain of it.
    it('does not allow an unlisted subdomain of the custom domain', () => {
      expect(isOriginAllowed('https://evil.vrcww.com', CONFIGURED)).toBe(false)
    })

    it('rejects a hostname that merely ends with a listed one', () => {
      expect(isOriginAllowed('https://notvrcww.com', CONFIGURED)).toBe(false)
    })

    it('rejects a scheme downgrade on a listed origin', () => {
      expect(isOriginAllowed('http://vrcww.com', CONFIGURED)).toBe(false)
    })

    it('ignores spacing around the separators', () => {
      expect(
        isOriginAllowed(
          'https://develop.vrcww.com',
          ' https://vrcww.com , https://develop.vrcww.com ',
        ),
      ).toBe(true)
    })
  })

  it('rejects an empty/malformed origin', () => {
    expect(
      isOriginAllowed('', 'https://vrchat-worlds-manager-web.pages.dev'),
    ).toBe(false)
  })
})

describe('parseSetCookieValue', () => {
  it('extracts the named cookie value and drops its attributes', () => {
    expect(
      parseSetCookieValue(
        ['auth=authcookie_abc; Path=/; HttpOnly; Secure; SameSite=Lax'],
        'auth',
      ),
    ).toBe('authcookie_abc')
  })

  it('picks the requested cookie out of several Set-Cookie headers', () => {
    expect(
      parseSetCookieValue(
        [
          'auth=authcookie_abc; Path=/',
          'twoFactorAuth=twofactorauth_xyz; Path=/',
        ],
        'twoFactorAuth',
      ),
    ).toBe('twofactorauth_xyz')
  })

  it('does not confuse a cookie whose name merely ends with the requested one', () => {
    expect(parseSetCookieValue(['twoFactorAuth=xyz; Path=/'], 'auth')).toBe(
      null,
    )
  })

  it('treats an expiring cookie as absent', () => {
    expect(parseSetCookieValue(['auth=; Path=/; Max-Age=0'], 'auth')).toBe(null)
  })

  it('returns null when no cookie was issued', () => {
    expect(parseSetCookieValue([], 'auth')).toBe(null)
  })
})

describe('buildVRChatCookieHeader', () => {
  it('sends both cookies once two-factor auth has been verified', () => {
    expect(buildVRChatCookieHeader('authcookie_abc', 'twofactorauth_xyz')).toBe(
      'auth=authcookie_abc; twoFactorAuth=twofactorauth_xyz',
    )
  })

  it('sends the auth cookie alone while no second factor is held', () => {
    expect(buildVRChatCookieHeader('authcookie_abc', null)).toBe(
      'auth=authcookie_abc',
    )
  })

  it('sends nothing when the caller holds no session', () => {
    expect(buildVRChatCookieHeader(null, null)).toBe(null)
    expect(buildVRChatCookieHeader('', '')).toBe(null)
  })
})

/** Durable Object storage as a map, with the two calls `countUse` makes. */
function fakeStorage(store: Map<string, number> = new Map()) {
  return {
    store,
    get: async <T>(key: string) => store.get(key) as T | undefined,
    put: async <T>(key: string, value: T) => {
      store.set(key, value as number)
    },
  }
}

/**
 * A `USAGE_COUNTER` namespace whose objects count in maps, one per name, or
 * one whose every object throws. `counters` is what each object holds.
 */
function fakeEnv(failing = false, vars: Partial<Env> = {}) {
  const counters = new Map<string, Map<string, number>>()
  const namespace = {
    idFromName: (name: string) => name,
    get: (name: string) => ({
      count: async (bucket: string, limit: number) => {
        if (failing) {
          throw new Error('the Durable Object is unwell')
        }
        const store = counters.get(name) ?? new Map<string, number>()
        counters.set(name, store)
        return countUse(fakeStorage(store), bucket, limit)
      },
    }),
  }
  const env: Env = {
    ALLOWED_ORIGIN: 'https://example.invalid',
    VRCHAT_API_BASE: 'https://api.invalid/api/1',
    USAGE_COUNTER: namespace as unknown as Env['USAGE_COUNTER'],
    ...vars,
  }
  return { env, counters }
}

// KV read, compared and wrote in three steps, so two requests at once both
// passed a bucket with one use left (#171). A Durable Object runs `countUse`
// one event at a time; what is tested here is the counting itself.
describe('counting a use', () => {
  it('counts it and lets it through while under the limit', async () => {
    const storage = fakeStorage()

    const result = await countUse(storage, 'day:2026-09-24', 10)

    expect(result).toEqual({ allowed: true, count: 1 })
    expect([...storage.store.values()]).toEqual([1])
  })

  it('refuses once the bucket is full, and writes nothing for the refusal', async () => {
    // A caller who keeps knocking after the limit must not keep costing
    // writes: those are what the free plan runs out of.
    const storage = fakeStorage()
    for (let i = 0; i < 3; i++) {
      await countUse(storage, 'day:2026-09-24', 3)
    }
    let writes = 0
    const counting = {
      ...storage,
      put: async <T>(key: string, value: T) => {
        writes += 1
        await storage.put(key, value)
      },
    }

    const result = await countUse(counting, 'day:2026-09-24', 3)

    expect(result).toEqual({ allowed: false, count: 3 })
    expect(writes).toBe(0)
  })

  it('starts a new bucket for a new period', async () => {
    const storage = fakeStorage()
    await countUse(storage, 'day:2026-09-24', 1)

    const result = await countUse(storage, 'day:2026-09-25', 1)

    expect(result.allowed).toBe(true)
  })
})

describe('the day boundary', () => {
  it('is the next midnight UTC, whatever the hour', () => {
    expect(nextUtcMidnight(new Date('2026-09-24T23:59:59Z'))).toBe(
      Date.parse('2026-09-25T00:00:00Z'),
    )
    expect(nextUtcMidnight(new Date('2026-09-24T00:00:00Z'))).toBe(
      Date.parse('2026-09-25T00:00:00Z'),
    )
  })

  it('is what a refused caller is told to wait for', () => {
    expect(secondsUntilUtcMidnight(new Date('2026-09-24T23:00:00Z'))).toBe(3600)
  })
})

/**
 * A counter failure used to leave the whole `fetch` handler through the
 * exception, so the response carried no CORS headers and the browser reported
 * a connection failure instead of an error (#170).
 */
describe('counting against a named counter', () => {
  it('lets a use through and says how many the bucket holds', async () => {
    const { env } = fakeEnv()

    const counted = await countAgainst(env, 'ip:198.51.100.7', 'day:d', 10)

    expect(counted).toEqual({ outcome: 'within-limit', count: 1 })
    expect(isRefusedBy(counted.outcome)).toBe(false)
  })

  it('refuses once the bucket is full', async () => {
    const { env } = fakeEnv()
    for (let i = 0; i < 3; i++) {
      await countAgainst(env, 'ip:198.51.100.7', 'day:d', 3)
    }

    const counted = await countAgainst(env, 'ip:198.51.100.7', 'day:d', 3)

    expect(counted.outcome).toBe('over-limit')
    expect(isRefusedBy(counted.outcome)).toBe(true)
  })

  it('counts each address on its own', async () => {
    const { env } = fakeEnv()
    await countAgainst(env, 'ip:198.51.100.7', 'day:d', 1)

    const counted = await countAgainst(env, 'ip:203.0.113.9', 'day:d', 1)

    expect(counted.outcome).toBe('within-limit')
  })

  it('keeps sign-in attempts in a bucket of their own', async () => {
    const { env, counters } = fakeEnv()

    await countAgainst(env, 'ip:198.51.100.7', 'day:d', 10)
    await countAgainst(env, 'ip:198.51.100.7', 'login:h', 10)

    expect(counters.get('ip:198.51.100.7')).toEqual(
      new Map([
        ['day:d', 1],
        ['login:h', 1],
      ]),
    )
  })

  it('says the counter is unavailable when it fails, and does not refuse', async () => {
    // Refusing would close the app for everyone over what may be a moment's
    // trouble with the counter.
    const counted = await countAgainst(
      fakeEnv(true).env,
      'ip:198.51.100.7',
      'day:d',
      10,
    )

    expect(counted).toEqual({ outcome: 'counter-unavailable', count: null })
    expect(isRefusedBy(counted.outcome)).toBe(false)
  })
})

describe('the limits', () => {
  it('come from the vars when they are positive integers', () => {
    const { env } = fakeEnv(false, {
      IP_DAILY_LIMIT: '100',
      LOGIN_HOURLY_LIMIT: '5',
      DAILY_QUOTA: '2000',
    })

    expect(readLimits(env)).toEqual({
      ipDaily: 100,
      loginHourly: 5,
      daily: 2000,
    })
  })

  it('fall back to the defaults when unset', () => {
    expect(readLimits(fakeEnv().env)).toEqual(DEFAULT_LIMITS)
  })

  it('fall back to the defaults rather than refusing everyone over a typo', () => {
    // `0`, a negative or a word would otherwise refuse every request, or none.
    const { env } = fakeEnv(false, {
      IP_DAILY_LIMIT: '0',
      LOGIN_HOURLY_LIMIT: '-3',
      DAILY_QUOTA: 'lots',
    })

    expect(readLimits(env)).toEqual(DEFAULT_LIMITS)
  })
})
