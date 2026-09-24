/**
 * Cloudflare Worker: CORS proxy for VRChat API
 *
 * - Proxies requests to api.vrchat.cloud with CORS headers
 * - Relays authentication cookies/tokens
 * - Rate limits by IP (daily), with a far tighter hourly limit on credential
 *   attempts, and a daily quota for the whole Worker, all counted in a
 *   Durable Object (`UsageCounter`)
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

import { nextUtcMidnight, type UsageCounter } from './usage-counter'

export interface Env {
  ALLOWED_ORIGIN: string
  VRCHAT_API_BASE: string
  USAGE_COUNTER: DurableObjectNamespace<UsageCounter>
  /** Each a positive integer as a string; see `DEFAULT_LIMITS`. */
  IP_DAILY_LIMIT?: string
  LOGIN_HOURLY_LIMIT?: string
  DAILY_QUOTA?: string
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

/**
 * The limits, used when `wrangler.toml` does not set them.
 *
 * `wrangler.sample.toml` sets all three under `[vars]`, and the deploy copies
 * it, so these are what a missing or mistyped value falls back to rather than
 * what production runs with.
 */
export const DEFAULT_LIMITS = {
  /**
   * Relays one address may make in a UTC day (#171).
   *
   * Purging VRChat's favourites sends one request per favourite, so a person
   * with a few hundred of them needs a few hundred here to finish in a day.
   */
  ipDaily: 1_000,
  /**
   * Credential attempts get their own, much smaller allowance.
   *
   * A password guess and a two-factor guess both come through here, and the
   * second is six digits -- a million codes. Thirty an hour turns walking them
   * into millennia while leaving far more room than a person mistyping a
   * password needs.
   */
  loginHourly: 30,
  /** Relays the whole Worker may make in a UTC day, everyone together. */
  daily: 90_000,
}

export type Limits = typeof DEFAULT_LIMITS

function parseLimit(raw: string | undefined, fallback: number, name: string) {
  if (raw === undefined) {
    return fallback
  }
  const value = Number(raw)
  if (!Number.isInteger(value) || value <= 0) {
    console.error(
      `${name} is not a positive integer (${raw}); using ${fallback}`,
    )
    return fallback
  }
  return value
}

export function readLimits(env: Env): Limits {
  return {
    ipDaily: parseLimit(
      env.IP_DAILY_LIMIT,
      DEFAULT_LIMITS.ipDaily,
      'IP_DAILY_LIMIT',
    ),
    loginHourly: parseLimit(
      env.LOGIN_HOURLY_LIMIT,
      DEFAULT_LIMITS.loginHourly,
      'LOGIN_HOURLY_LIMIT',
    ),
    daily: parseLimit(env.DAILY_QUOTA, DEFAULT_LIMITS.daily, 'DAILY_QUOTA'),
  }
}

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
 * The app is served from more than one origin -- its own domain, and the
 * `pages.dev` one it was reached at before that domain existed -- so
 * `ALLOWED_ORIGIN` is a comma-separated list and an origin need match only
 * one entry. A single origin is still a list of one, so nothing that
 * configured it that way has to change.
 */
function allowedOrigins(allowedOrigin: string): string[] {
  return allowedOrigin
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
}

/**
 * Cloudflare Pages serves every branch/preview deployment of a project under
 * `<branch>.<project>.pages.dev`, and only the project owner can deploy to
 * that subdomain — so when an entry is itself a `*.pages.dev` origin, also
 * allow its preview subdomains. This isn't a wildcard over all of
 * `pages.dev`: an unrelated project can never obtain a hostname ending in
 * `.<project>.pages.dev`.
 *
 * A custom domain gets no such treatment, deliberately: nothing about owning
 * `example.com` says every `*.example.com` is this app. A subdomain that
 * serves it -- `develop.` does -- is listed in `ALLOWED_ORIGIN` by name.
 */
export function isOriginAllowed(
  origin: string,
  allowedOrigin: string,
): boolean {
  if (allowedOrigin === '*') {
    return true
  }

  const entries = allowedOrigins(allowedOrigin)
  if (entries.includes(origin)) {
    return true
  }

  return entries.some((entry) => {
    try {
      const allowed = new URL(entry)
      const requested = new URL(origin)
      return (
        requested.protocol === allowed.protocol &&
        allowed.hostname.endsWith('.pages.dev') &&
        requested.hostname.endsWith(`.${allowed.hostname}`)
      )
    } catch {
      return false
    }
  })
}

function corsHeaders(origin: string, allowedOrigin: string): HeadersInit {
  // An origin this Worker turned away is still answered with a single valid
  // origin rather than the whole list, which is not a value the header can
  // carry. The first entry is the app's own domain.
  const effectiveOrigin = isOriginAllowed(origin, allowedOrigin)
    ? origin
    : (allowedOrigins(allowedOrigin)[0] ?? allowedOrigin)
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
 * A counter failure lets the request through, deliberately.
 *
 * The alternative is refusing everything for as long as the counter is
 * unwell, which
 * turns a storage blip into an outage of the whole app. What it costs is that
 * the cap is not enforced while the counter is down -- acceptable here
 * because the free plan cannot be billed past its limits (Cloudflare simply
 * stops), and because this Worker serves a few hundred requests a week
 * against a cap of ninety thousand a day.
 *
 * **On a paid plan this reasoning does not hold**: there is no spend limit
 * for Workers or Durable Objects, `DAILY_QUOTA` is the only lever, and failing open
 * removes it exactly when something is going wrong. Revisit this before
 * upgrading (#170).
 */
export function isRefusedBy(outcome: CountOutcome): boolean {
  return outcome === 'over-limit'
}

/** What `countAgainst` came to, and the bucket's count when it could say. */
export interface Counted {
  outcome: CountOutcome
  count: number | null
}

/**
 * Counts one use against a bucket of the named counter, and never throws.
 *
 * `counter` names the Durable Object -- one per address, `ip:<address>`, and
 * one for the Worker as a whole -- and `bucket` the period inside it.
 *
 * A failure used to leave the whole `fetch` handler through the exception,
 * which meant the response carried no CORS headers and the browser saw a
 * connection failure rather than an error (#170). See `isRefusedBy` for why
 * it lets the request through instead.
 */
export async function countAgainst(
  env: Env,
  counter: string,
  bucket: string,
  limit: number,
): Promise<Counted> {
  try {
    const stub = env.USAGE_COUNTER.get(env.USAGE_COUNTER.idFromName(counter))
    const { allowed, count } = await stub.count(bucket, limit)
    return { outcome: allowed ? 'within-limit' : 'over-limit', count }
  } catch (err) {
    // The bucket and not the counter: the counter's name is an address.
    console.error(`Usage counter unavailable (${bucket}): ${String(err)}`)
    return { outcome: 'counter-unavailable', count: null }
  }
}

/** Seconds from `now` until the daily buckets start again. */
export function secondsUntilUtcMidnight(now: Date): number {
  return Math.ceil((nextUtcMidnight(now) - now.getTime()) / 1000)
}

function tooManyRequests(
  origin: string,
  allowedOrigin: string,
  error: string,
  retryAfterSeconds: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify({ error }), {
    status: 429,
    headers: {
      ...corsHeaders(origin, allowedOrigin),
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSeconds),
      ...extraHeaders,
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

    const limits = readLimits(env)
    const now = new Date()
    const day = `day:${now.toISOString().slice(0, 10)}` // "day:2026-09-24"
    const addressCounter = `ip:${ip}`

    if (
      isRefusedBy(
        (await countAgainst(env, addressCounter, day, limits.ipDaily)).outcome,
      )
    ) {
      return tooManyRequests(
        origin,
        env.ALLOWED_ORIGIN,
        RATE_LIMIT_EXCEEDED,
        secondsUntilUtcMidnight(now),
      )
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

      const hour = `login:${now.toISOString().slice(0, 13)}` // "login:2026-09-24T02"
      if (
        isRefusedBy(
          (await countAgainst(env, addressCounter, hour, limits.loginHourly))
            .outcome,
        )
      ) {
        return tooManyRequests(
          origin,
          env.ALLOWED_ORIGIN,
          SIGN_IN_LIMIT_EXCEEDED,
          // The sign-in buckets are hourly, so the next is at most an hour away.
          3600,
        )
      }
    }

    // Counted before VRChat is asked rather than after it answers: one call
    // both checks and spends, where KV needed a read before and a write after.
    // A `null` count means the counter could not say, which is not the same
    // as "none left".
    const quota = await countAgainst(env, 'worker', day, limits.daily)
    if (isRefusedBy(quota.outcome)) {
      return tooManyRequests(
        origin,
        env.ALLOWED_ORIGIN,
        DAILY_QUOTA_EXCEEDED,
        secondsUntilUtcMidnight(now),
        { 'X-Quota-Remaining': '0' },
      )
    }
    const quotaRemaining =
      quota.count === null ? null : Math.max(0, limits.daily - quota.count)

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
      // Only the request to VRChat can land here: the quota is counted before
      // it, and `countAgainst` never throws, so a counter failure cannot turn
      // an answer VRChat already gave into a proxy failure (#170).
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
