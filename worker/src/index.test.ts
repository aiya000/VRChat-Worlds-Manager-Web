import { describe, expect, it } from 'vitest'

import {
  buildProxyHeaders,
  buildVRChatCookieHeader,
  countAgainstHourlyLimit,
  getQuotaRemaining,
  incrementQuota,
  isCredentialAttempt,
  isOriginAllowed,
  isRefusedBy,
  isRouteAllowed,
  parseSetCookieValue,
  type Env,
} from './index'

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

/**
 * A KV that answers from a map, or refuses everything. The counters read,
 * compare and write, so both halves have to be able to fail.
 */
function fakeEnv(
  store: Map<string, string>,
  failing: 'none' | 'get' | 'put' = 'none',
): Env {
  const quota = {
    get: async (key: string) => {
      if (failing === 'get') {
        throw new Error('KV is unwell')
      }
      return store.get(key) ?? null
    },
    put: async (key: string, value: string) => {
      if (failing === 'put') {
        throw new Error('KV is unwell')
      }
      store.set(key, value)
    },
  }
  return {
    ALLOWED_ORIGIN: 'https://example.invalid',
    VRCHAT_API_BASE: 'https://api.invalid/api/1',
    QUOTA: quota as unknown as Env['QUOTA'],
  }
}

/**
 * A counter that cannot be read used to leave the whole `fetch` handler
 * through the exception, so the response carried no CORS headers and the
 * browser reported a connection failure instead of an error (#170).
 */
describe('counting against an hourly bucket', () => {
  it('counts a use and allows it while under the limit', async () => {
    const store = new Map<string, string>()

    const outcome = await countAgainstHourlyLimit(
      fakeEnv(store),
      'ip',
      '198.51.100.7',
      10,
    )

    expect(outcome).toBe('within-limit')
    expect(isRefusedBy(outcome)).toBe(false)
    expect([...store.values()]).toEqual(['1'])
  })

  it('refuses once the bucket is full, and does not count further', async () => {
    const store = new Map<string, string>()
    const env = fakeEnv(store)
    for (let i = 0; i < 3; i++) {
      await countAgainstHourlyLimit(env, 'ip', '198.51.100.7', 3)
    }

    const outcome = await countAgainstHourlyLimit(env, 'ip', '198.51.100.7', 3)

    expect(outcome).toBe('over-limit')
    expect(isRefusedBy(outcome)).toBe(true)
    expect([...store.values()]).toEqual(['3'])
  })

  it('says the counter is unavailable when KV cannot be read, and does not refuse', async () => {
    const outcome = await countAgainstHourlyLimit(
      fakeEnv(new Map(), 'get'),
      'ip',
      '198.51.100.7',
      10,
    )

    expect(outcome).toBe('counter-unavailable')
    expect(isRefusedBy(outcome)).toBe(false)
  })

  it('says the same when KV cannot be written to', async () => {
    const outcome = await countAgainstHourlyLimit(
      fakeEnv(new Map(), 'put'),
      'ip',
      '198.51.100.7',
      10,
    )

    expect(outcome).toBe('counter-unavailable')
    expect(isRefusedBy(outcome)).toBe(false)
  })

  it('keeps sign-in attempts in a bucket of their own', async () => {
    const store = new Map<string, string>()
    const env = fakeEnv(store)

    await countAgainstHourlyLimit(env, 'ip', '198.51.100.7', 10)
    await countAgainstHourlyLimit(env, 'login', '198.51.100.7', 10)

    expect([...store.values()]).toEqual(['1', '1'])
  })
})

describe('the daily quota', () => {
  it('answers null rather than zero when KV cannot be read', async () => {
    // Zero would read as "today's allowance is spent" and close the app for
    // everyone over what may be a moment's trouble.
    expect(await getQuotaRemaining(fakeEnv(new Map(), 'get'))).toBeNull()
  })

  it('counts a request, and reports what is left', async () => {
    const store = new Map<string, string>()
    const env = fakeEnv(store)

    const before = await getQuotaRemaining(env)
    const after = await incrementQuota(env)

    expect(before).not.toBeNull()
    expect(after).toBe((before as number) - 1)
  })

  it('does not throw when it cannot count, so an answer already given survives', async () => {
    // This runs after VRChat has replied. Throwing here reached the proxy's
    // own `catch`, which reported a successful request as `502 Proxy error`.
    expect(await incrementQuota(fakeEnv(new Map(), 'put'))).toBeNull()
  })
})
