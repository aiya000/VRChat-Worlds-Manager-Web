/**
 * Cloudflare Worker: CORS proxy for VRChat API
 *
 * - Proxies requests to api.vrchat.cloud with CORS headers
 * - Relays authentication cookies/tokens
 * - Rate limits by IP (hourly), with a far tighter limit on credential
 *   attempts, and a daily quota, all in KV
 * - Whitelists only API endpoints used by the app, and only the headers
 *   VRChat is meant to see
 * - Asks every credential attempt for a Cloudflare Turnstile token, once a
 *   secret has been set, and checks it with Cloudflare before anything else
 *   is spent on the request
 *
 * What this cannot do, and why it is written down rather than assumed: the
 * `Origin` check keeps other *websites* out, but anything that is not a
 * browser sets whatever `Origin` it likes, so it stops nothing from `curl`.
 * The limits below are what actually stands between this Worker and someone
 * using it as a stepping stone. See #61.
 */

export interface Env {
  ALLOWED_ORIGIN: string
  VRCHAT_API_BASE: string
  QUOTA: KVNamespace
  /**
   * The Turnstile widget's secret, set with `wrangler secret put` rather than
   * in `wrangler.toml`. Absent, credential attempts are asked for no bot
   * check -- which is what lets the dashboard steps of #61 and this code
   * land in either order.
   */
  TURNSTILE_SECRET_KEY?: string
}

/** Sent by the frontend on credential attempts; consumed here, never forwarded. */
const TURNSTILE_TOKEN_HEADER = 'X-Turnstile-Token'

const TURNSTILE_VERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/**
 * What a credential attempt's bot check came to.
 *
 * `skipped` is the Worker without a secret. `missing` and `failed` both end
 * in a 403, told apart in the body so a browser that never ran the challenge
 * can be distinguished from one whose token Cloudflare turned down.
 */
export type BotCheck =
  | { kind: 'passed' }
  | { kind: 'skipped' }
  | { kind: 'missing' }
  | { kind: 'failed'; codes: string[] }

/**
 * Asks Cloudflare whether a Turnstile token is one a real browser earned
 * moments ago. A token is single-use, so the answer is not cached anywhere.
 *
 * `fetcher` is injectable so the tests can answer for Cloudflare.
 */
export async function checkTurnstile(
  secret: string | undefined,
  token: string | null,
  ip: string,
  fetcher: typeof fetch = fetch,
): Promise<BotCheck> {
  if (secret === undefined || secret === '') {
    return { kind: 'skipped' }
  }
  if (token === null || token === '') {
    return { kind: 'missing' }
  }
  try {
    const response = await fetcher(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret,
        response: token,
        // Cloudflare's own placeholder for an address it did not set.
        ...(ip === 'unknown' ? {} : { remoteip: ip }),
      }),
    })
    const verdict = (await response.json()) as {
      success?: boolean
      'error-codes'?: string[]
    }
    if (verdict.success === true) {
      return { kind: 'passed' }
    }
    return { kind: 'failed', codes: verdict['error-codes'] ?? [] }
  } catch {
    // Cloudflare unreachable is not a pass: this is the one gate in front of
    // VRChat's login, and open-on-failure would make it the easiest to walk
    // through exactly when it is under load.
    return { kind: 'failed', codes: ['internal-error'] }
  }
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
    'Access-Control-Allow-Headers': `Content-Type, Authorization, Cookie, X-Requested-With, ${AUTH_TOKEN_HEADER}, ${TWO_FACTOR_TOKEN_HEADER}, ${TURNSTILE_TOKEN_HEADER}`,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': `X-Quota-Remaining, ${AUTH_TOKEN_HEADER}, ${TWO_FACTOR_TOKEN_HEADER}`,
  }
}

/**
 * Why the Worker turned a request away, in a word rather than a sentence.
 *
 * These strings are the interface between the two halves of the app: the
 * frontend matches on them in `src/lib/services/backend-limit.ts` to say
 * which limit was reached, so changing one here without changing it there
 * puts the generic error back in front of the user (#170).
 */
export const RATE_LIMIT_EXCEEDED = 'rate-limit-exceeded'
export const SIGN_IN_LIMIT_EXCEEDED = 'sign-in-limit-exceeded'
export const DAILY_QUOTA_EXCEEDED = 'daily-quota-exceeded'
export const UPSTREAM_UNREACHABLE = 'upstream-unreachable'

/**
 * What happened when a use was counted against a bucket.
 *
 * `counter-unavailable` is its own answer rather than folded into either of
 * the others, because the two are opposite decisions: over the limit is a
 * refusal, and a counter that cannot be read is not.
 */
export type CountOutcome = 'within-limit' | 'over-limit' | 'counter-unavailable'

/**
 * A KV failure lets the request through, deliberately.
 *
 * The alternative is refusing everything for as long as KV is unwell, which
 * turns a storage blip into an outage of the whole app. What it costs is that
 * the cap is not enforced while the counter is down -- acceptable here
 * because the free plan cannot be billed past its limits (Cloudflare simply
 * stops), and because this Worker serves a few hundred requests a week
 * against a cap of ninety thousand a day.
 *
 * **On a paid plan this reasoning does not hold**: there is no spend limit
 * for Workers or KV, `DAILY_QUOTA` is the only lever, and failing open
 * removes it exactly when something is going wrong. Revisit this before
 * upgrading (#170).
 */
export function isRefusedBy(outcome: CountOutcome): boolean {
  return outcome === 'over-limit'
}

/**
 * Reads today's quota, or `null` when KV could not say.
 *
 * `null` is not zero: an unreadable counter must not read as "the day's
 * allowance is spent", which would turn a KV blip into a closed app.
 */
export async function getQuotaRemaining(env: Env): Promise<number | null> {
  const today = new Date().toISOString().slice(0, 10)
  const key = `quota:${today}`
  try {
    const current = parseInt((await env.QUOTA.get(key)) || '0', 10)
    return Math.max(0, DAILY_QUOTA - current)
  } catch (err) {
    console.error(`Daily quota unreadable (${key}): ${String(err)}`)
    return null
  }
}

/**
 * Counts one request against today's quota, and never throws.
 *
 * This runs after the upstream answered, so an exception here used to be
 * caught by the proxy's own `catch` and reported as a proxy failure -- a
 * request VRChat had already answered came back as `502 Proxy error` (#170).
 */
export async function incrementQuota(env: Env): Promise<number | null> {
  const today = new Date().toISOString().slice(0, 10)
  const key = `quota:${today}`
  try {
    const current = parseInt((await env.QUOTA.get(key)) || '0', 10)
    const next = current + 1
    await env.QUOTA.put(key, String(next), { expirationTtl: 172800 })
    return Math.max(0, DAILY_QUOTA - next)
  } catch (err) {
    console.error(`Daily quota not counted (${key}): ${String(err)}`)
    return null
  }
}

/**
 * Counts one use against an hourly bucket and says how it went.
 *
 * KV cannot count atomically -- this reads, compares and writes, so requests
 * that arrive together all read the same number and the limit can be overrun
 * by however many are in flight at once. That bounds the overrun by
 * concurrency rather than removing it, which is enough for a coarse cap and
 * is not enough for anything finer. Moving these counters to a Rate Limiting
 * binding or a Durable Object is the fix, and is listed in #61.
 *
 * A KV failure used to leave the whole `fetch` handler through the exception,
 * which meant the response carried no CORS headers and the browser saw a
 * connection failure rather than an error (#170). See `isRefusedBy` for why
 * it now lets the request through instead.
 */
export async function countAgainstHourlyLimit(
  env: Env,
  keyPrefix: string,
  ip: string,
  limit: number,
): Promise<CountOutcome> {
  const hour = new Date().toISOString().slice(0, 13) // "2025-05-03T12"
  const key = `${keyPrefix}:${ip}:${hour}`
  try {
    const current = parseInt((await env.QUOTA.get(key)) || '0', 10)
    if (current >= limit) {
      return 'over-limit'
    }
    await env.QUOTA.put(key, String(current + 1), { expirationTtl: 7200 })
    return 'within-limit'
  } catch (err) {
    console.error(`Hourly counter unavailable (${key}): ${String(err)}`)
    return 'counter-unavailable'
  }
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

    if (
      isRefusedBy(await countAgainstHourlyLimit(env, 'ip', ip, IP_HOURLY_LIMIT))
    ) {
      return tooManyRequests(origin, env.ALLOWED_ORIGIN, RATE_LIMIT_EXCEEDED)
    }

    if (
      isCredentialAttempt(
        request.method,
        apiPath,
        request.headers.get('Authorization'),
      )
    ) {
      // The bot check comes before the sign-in allowance is spent: a request
      // that never ran the challenge is turned away without costing the
      // person behind that address one of their thirty tries.
      const botCheck = await checkTurnstile(
        env.TURNSTILE_SECRET_KEY,
        request.headers.get(TURNSTILE_TOKEN_HEADER),
        ip,
      )
      if (botCheck.kind === 'missing' || botCheck.kind === 'failed') {
        return new Response(
          JSON.stringify(
            botCheck.kind === 'missing'
              ? { error: 'bot-check-required' }
              : { error: 'bot-check-failed', codes: botCheck.codes },
          ),
          {
            status: 403,
            headers: {
              ...corsHeaders(origin, env.ALLOWED_ORIGIN),
              'Content-Type': 'application/json',
            },
          },
        )
      }

      if (
        isRefusedBy(
          await countAgainstHourlyLimit(env, 'login', ip, LOGIN_HOURLY_LIMIT),
        )
      ) {
        return tooManyRequests(
          origin,
          env.ALLOWED_ORIGIN,
          SIGN_IN_LIMIT_EXCEEDED,
        )
      }
    }

    // Daily quota check. `null` means KV could not say, which is not the same
    // as "none left" -- see `getQuotaRemaining`.
    const remaining = await getQuotaRemaining(env)
    if (remaining !== null && remaining <= 0) {
      return new Response(JSON.stringify({ error: DAILY_QUOTA_EXCEEDED }), {
        status: 429,
        headers: {
          ...corsHeaders(origin, env.ALLOWED_ORIGIN),
          'Content-Type': 'application/json',
          'X-Quota-Remaining': '0',
          // The quota is daily, but it is spent by everyone together, so the
          // hour is what is worth waiting rather than the day.
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
      // Absent rather than wrong: a counter that could not be read says
      // nothing about what is left.
      if (quotaRemaining !== null) {
        responseHeaders.set('X-Quota-Remaining', String(quotaRemaining))
      }

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
      // Only the request to VRChat can land here now. Counting the quota is
      // inside its own `try`, so a KV failure no longer turns an answer
      // VRChat already gave into a proxy failure (#170).
      console.error(`Upstream request failed (${targetUrl}): ${String(err)}`)
      return new Response(
        JSON.stringify({ error: UPSTREAM_UNREACHABLE, details: String(err) }),
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
