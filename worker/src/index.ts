/**
 * Cloudflare Worker: CORS proxy for VRChat API
 *
 * - Proxies requests to api.vrchat.cloud with CORS headers
 * - Relays authentication cookies/tokens
 * - Rate limits by IP (hourly), with a far tighter limit on credential
 *   attempts, and a daily quota, all in KV
 * - Whitelists only API endpoints used by the app, and only the headers
 *   VRChat is meant to see
 *
 * What this cannot do, and why it is written down rather than assumed: the
 * `Origin` check keeps other *websites* out, but anything that is not a
 * browser sets whatever `Origin` it likes, so it stops nothing from `curl`.
 * The limits below are what actually stands between this Worker and someone
 * using it as a stepping stone. See #61.
 */

interface Env {
  ALLOWED_ORIGIN: string
  VRCHAT_API_BASE: string
  QUOTA: KVNamespace
}

const DAILY_QUOTA = 90_000
const IP_HOURLY_LIMIT = 500

/**
 * Credential attempts get their own, much smaller allowance.
 *
 * A password guess and a two-factor guess both come through here, and the
 * second is six digits -- a million codes, which 500 tries an hour would walk
 * in a few months. Thirty an hour turns that into millennia while leaving far
 * more room than a person mistyping a password needs.
 */
const LOGIN_HOURLY_LIMIT = 30

interface AllowedRoute {
  method: string
  pattern: RegExp
}

// Whitelist: only endpoints the app actually uses
const ALLOWED_ROUTES: AllowedRoute[] = [
  { method: 'GET', pattern: /^\/auth\/user$/ },
  {
    method: 'POST',
    pattern: /^\/auth\/twofactorauth\/(totp|emailotp|otp)\/verify$/,
  },
  { method: 'PUT', pattern: /^\/logout$/ },
  { method: 'GET', pattern: /^\/favorites$/ },
  { method: 'DELETE', pattern: /^\/favorites\/[^/]+$/ },
  { method: 'GET', pattern: /^\/worlds$/ },
  { method: 'GET', pattern: /^\/worlds\/[^/]+$/ },
  { method: 'POST', pattern: /^\/instances$/ },
  // The "Invite Me" the website sends. An instance id carries `~`, `(`, `)`
  // and `:`, none of which is a slash.
  { method: 'POST', pattern: /^\/invite\/myself\/to\/[^/]+$/ },
  { method: 'GET', pattern: /^\/users\/[^/]+\/groups$/ },
  { method: 'GET', pattern: /^\/groups\/[^/]+\/instances\/permissions$/ },
]

/**
 * `[^/]+` in the patterns above matches `..`, so `/worlds/..` passed the
 * whitelist as an approved route and then collapsed to something else when
 * the target URL was parsed. Encoded forms have to go too, since it is the
 * upstream server that decodes them, not us -- and by then the whitelist has
 * already had its say.
 */
function hasTraversalSegment(apiPath: string): boolean {
  return apiPath
    .split('/')
    .some((segment) => /^(\.|\.\.|%2e|%2e%2e)$/i.test(segment))
}

export function isRouteAllowed(method: string, apiPath: string): boolean {
  if (hasTraversalSegment(apiPath)) {
    return false
  }
  return ALLOWED_ROUTES.some(
    (route) => route.method === method && route.pattern.test(apiPath),
  )
}

/**
 * Whether this request is someone offering credentials, as opposed to using a
 * session they already hold.
 *
 * `GET /auth/user` is both "log me in" and "who am I?" -- the difference is
 * the `Basic` header, which only the login screen sends. Counting the second
 * as an attempt would spend the allowance on ordinary page loads.
 */
export function isCredentialAttempt(
  method: string,
  apiPath: string,
  authorization: string | null,
): boolean {
  if (
    method === 'GET' &&
    apiPath === '/auth/user' &&
    authorization !== null &&
    /^Basic\s/i.test(authorization)
  ) {
    return true
  }
  return (
    method === 'POST' &&
    /^\/auth\/twofactorauth\/(totp|emailotp|otp)\/verify$/.test(apiPath)
  )
}

/**
 * The only headers the upstream is meant to see.
 *
 * Everything the caller sent used to be forwarded, so this Worker would carry
 * any header at all to VRChat on a stranger's behalf. `Cookie` is absent on
 * purpose: it is rebuilt here from the tokens the app holds, never taken from
 * the request.
 */
const FORWARDED_HEADERS = [
  'accept',
  'accept-language',
  'authorization',
  'content-type',
  // VRChat's WAF rejects a request without a descriptive one.
  'user-agent',
]

export function buildProxyHeaders(
  requestHeaders: Headers,
  cookieHeader: string | null,
): Headers {
  const headers = new Headers()
  for (const name of FORWARDED_HEADERS) {
    const value = requestHeaders.get(name)
    if (value !== null) {
      headers.set(name, value)
    }
  }
  if (cookieHeader !== null) {
    headers.set('Cookie', cookieHeader)
  }
  return headers
}

/**
 * The frontend (`*.pages.dev`) and this Worker (`*.workers.dev`) sit on
 * different registrable domains, so a `Set-Cookie` relayed from VRChat is a
 * cross-site cookie the browser will not send back on later requests. Hand the
 * session over as headers instead, and rebuild the `Cookie` header here.
 */
const AUTH_TOKEN_HEADER = 'X-VRC-Auth'
const TWO_FACTOR_TOKEN_HEADER = 'X-VRC-Two-Factor-Auth'
const AUTH_COOKIE_NAME = 'auth'
const TWO_FACTOR_COOKIE_NAME = 'twoFactorAuth'

function readSetCookies(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[]
  }
  if (typeof withGetSetCookie.getSetCookie === 'function') {
    return withGetSetCookie.getSetCookie()
  }
  const raw = headers.get('Set-Cookie')
  return raw === null ? [] : [raw]
}

/**
 * An empty value means VRChat is expiring the cookie rather than issuing one,
 * so it is reported as absent: the frontend drops its tokens on logout.
 */
export function parseSetCookieValue(
  setCookies: string[],
  name: string,
): string | null {
  for (const setCookie of setCookies) {
    const [pair] = setCookie.split(';')
    const separatorIndex = pair.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }
    if (pair.slice(0, separatorIndex).trim() !== name) {
      continue
    }
    const value = pair.slice(separatorIndex + 1).trim()
    if (value === '') {
      continue
    }
    return value
  }
  return null
}

export function buildVRChatCookieHeader(
  authToken: string | null,
  twoFactorToken: string | null,
): string | null {
  const cookies: string[] = []
  if (authToken !== null && authToken !== '') {
    cookies.push(`${AUTH_COOKIE_NAME}=${authToken}`)
  }
  if (twoFactorToken !== null && twoFactorToken !== '') {
    cookies.push(`${TWO_FACTOR_COOKIE_NAME}=${twoFactorToken}`)
  }
  return cookies.length === 0 ? null : cookies.join('; ')
}

/**
 * Cloudflare Pages serves every branch/preview deployment of a project under
 * `<branch>.<project>.pages.dev`, and only the project owner can deploy to
 * that subdomain — so when `allowedOrigin` is itself a `*.pages.dev` origin,
 * also allow its preview subdomains. This isn't a wildcard over all of
 * `pages.dev`: an unrelated project can never obtain a hostname ending in
 * `.<project>.pages.dev`.
 */
export function isOriginAllowed(
  origin: string,
  allowedOrigin: string,
): boolean {
  if (allowedOrigin === '*') {
    return true
  }
  if (origin === allowedOrigin) {
    return true
  }

  try {
    const allowed = new URL(allowedOrigin)
    const requested = new URL(origin)
    return (
      requested.protocol === allowed.protocol &&
      allowed.hostname.endsWith('.pages.dev') &&
      requested.hostname.endsWith(`.${allowed.hostname}`)
    )
  } catch {
    return false
  }
}

function corsHeaders(origin: string, allowedOrigin: string): HeadersInit {
  const effectiveOrigin = isOriginAllowed(origin, allowedOrigin)
    ? origin
    : allowedOrigin
  return {
    'Access-Control-Allow-Origin': effectiveOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': `Content-Type, Authorization, Cookie, X-Requested-With, ${AUTH_TOKEN_HEADER}, ${TWO_FACTOR_TOKEN_HEADER}`,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': `X-Quota-Remaining, ${AUTH_TOKEN_HEADER}, ${TWO_FACTOR_TOKEN_HEADER}`,
  }
}

async function getQuotaRemaining(env: Env): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const key = `quota:${today}`
  const current = parseInt((await env.QUOTA.get(key)) || '0', 10)
  return Math.max(0, DAILY_QUOTA - current)
}

async function incrementQuota(env: Env): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const key = `quota:${today}`
  const current = parseInt((await env.QUOTA.get(key)) || '0', 10)
  const next = current + 1
  await env.QUOTA.put(key, String(next), { expirationTtl: 172800 })
  return Math.max(0, DAILY_QUOTA - next)
}

/**
 * Counts one use against an hourly bucket and says whether it was within the
 * limit.
 *
 * KV cannot count atomically -- this reads, compares and writes, so requests
 * that arrive together all read the same number and the limit can be overrun
 * by however many are in flight at once. That bounds the overrun by
 * concurrency rather than removing it, which is enough for a coarse cap and
 * is not enough for anything finer. Moving these counters to a Rate Limiting
 * binding or a Durable Object is the fix, and is listed in #61.
 */
async function countAgainstHourlyLimit(
  env: Env,
  keyPrefix: string,
  ip: string,
  limit: number,
): Promise<boolean> {
  const hour = new Date().toISOString().slice(0, 13) // "2025-05-03T12"
  const key = `${keyPrefix}:${ip}:${hour}`
  const current = parseInt((await env.QUOTA.get(key)) || '0', 10)
  if (current >= limit) {
    return false
  }
  await env.QUOTA.put(key, String(current + 1), { expirationTtl: 7200 })
  return true
}

function tooManyRequests(
  origin: string,
  allowedOrigin: string,
  error: string,
): Response {
  return new Response(JSON.stringify({ error }), {
    status: 429,
    headers: {
      ...corsHeaders(origin, allowedOrigin),
      'Content-Type': 'application/json',
      // The buckets are hourly, so the next one is at most an hour away.
      'Retry-After': '3600',
    },
  })
}

export default {
  async fetch(
    request: Request,
    env: Env,
    _ctx: ExecutionContext,
  ): Promise<Response> {
    const origin = request.headers.get('Origin') || ''

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, env.ALLOWED_ORIGIN),
      })
    }

    // Verify origin
    if (!isOriginAllowed(origin, env.ALLOWED_ORIGIN)) {
      return new Response('Forbidden', { status: 403 })
    }

    // Decided before anything is counted, so a path this Worker would never
    // proxy cannot spend somebody else's allowance on its way to a 404.
    const url = new URL(request.url)
    const apiPath = url.pathname.replace(/^\/api\/1/, '')
    if (!isRouteAllowed(request.method, apiPath)) {
      return new Response('Not Found', {
        status: 404,
        headers: corsHeaders(origin, env.ALLOWED_ORIGIN),
      })
    }

    // A caller with no `CF-Connecting-IP` used to skip every limit below.
    // Cloudflare sets it on real traffic, so its absence is odd rather than
    // ordinary, and one shared bucket is the safe reading of it: still
    // counted, and never a way round the count.
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'

    if (!(await countAgainstHourlyLimit(env, 'ip', ip, IP_HOURLY_LIMIT))) {
      return tooManyRequests(origin, env.ALLOWED_ORIGIN, 'Rate limit exceeded')
    }

    if (
      isCredentialAttempt(
        request.method,
        apiPath,
        request.headers.get('Authorization'),
      ) &&
      !(await countAgainstHourlyLimit(env, 'login', ip, LOGIN_HOURLY_LIMIT))
    ) {
      return tooManyRequests(
        origin,
        env.ALLOWED_ORIGIN,
        'Too many sign-in attempts',
      )
    }

    // Daily quota check
    const remaining = await getQuotaRemaining(env)
    if (remaining <= 0) {
      return new Response(JSON.stringify({ error: 'Daily quota exceeded' }), {
        status: 429,
        headers: {
          ...corsHeaders(origin, env.ALLOWED_ORIGIN),
          'Content-Type': 'application/json',
          'X-Quota-Remaining': '0',
          'Retry-After': '3600',
        },
      })
    }

    const targetUrl = `${env.VRCHAT_API_BASE}${apiPath}${url.search}`

    const proxyHeaders = buildProxyHeaders(
      request.headers,
      buildVRChatCookieHeader(
        request.headers.get(AUTH_TOKEN_HEADER),
        request.headers.get(TWO_FACTOR_TOKEN_HEADER),
      ),
    )

    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      body:
        request.method !== 'GET' && request.method !== 'HEAD'
          ? request.body
          : undefined,
    })

    try {
      const response = await fetch(proxyRequest)

      const quotaRemaining = await incrementQuota(env)

      const responseHeaders = new Headers(response.headers)
      const cors = corsHeaders(origin, env.ALLOWED_ORIGIN)
      for (const [key, value] of Object.entries(cors)) {
        responseHeaders.set(key, value)
      }
      responseHeaders.set('X-Quota-Remaining', String(quotaRemaining))

      const setCookies = readSetCookies(response.headers)
      const issuedAuth = parseSetCookieValue(setCookies, AUTH_COOKIE_NAME)
      if (issuedAuth !== null) {
        responseHeaders.set(AUTH_TOKEN_HEADER, issuedAuth)
      }
      const issuedTwoFactor = parseSetCookieValue(
        setCookies,
        TWO_FACTOR_COOKIE_NAME,
      )
      if (issuedTwoFactor !== null) {
        responseHeaders.set(TWO_FACTOR_TOKEN_HEADER, issuedTwoFactor)
      }
      // The browser could not store these anyway (cross-site), and leaving
      // them in only invites confusion when debugging the session.
      responseHeaders.delete('Set-Cookie')

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      })
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Proxy error', details: String(err) }),
        {
          status: 502,
          headers: {
            ...corsHeaders(origin, env.ALLOWED_ORIGIN),
            'Content-Type': 'application/json',
          },
        },
      )
    }
  },
} satisfies ExportedHandler<Env>
