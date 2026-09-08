import { describe, expect, it } from 'vitest'

import { checkTurnstile } from './index'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

/** Answers for Cloudflare, and keeps what it was asked. */
function cloudflareSaying(body: unknown) {
  const calls: { url: string; form: URLSearchParams }[] = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({
      url: String(input),
      form: new URLSearchParams(String(init?.body)),
    })
    return new Response(JSON.stringify(body), {
      headers: { 'Content-Type': 'application/json' },
    })
  }) as typeof fetch
  return { fetcher, calls }
}

describe('checkTurnstile', () => {
  it('asks for nothing while no secret has been set', async () => {
    const cloudflare = cloudflareSaying({ success: true })
    expect(
      await checkTurnstile(
        undefined,
        'a-token',
        '203.0.113.9',
        cloudflare.fetcher,
      ),
    ).toEqual({ kind: 'skipped' })
    expect(
      await checkTurnstile('', 'a-token', '203.0.113.9', cloudflare.fetcher),
    ).toEqual({ kind: 'skipped' })
    expect(cloudflare.calls).toHaveLength(0)
  })

  it('turns away a credential attempt that brought no token', async () => {
    const cloudflare = cloudflareSaying({ success: true })
    expect(
      await checkTurnstile('secret', null, '203.0.113.9', cloudflare.fetcher),
    ).toEqual({ kind: 'missing' })
    expect(
      await checkTurnstile('secret', '', '203.0.113.9', cloudflare.fetcher),
    ).toEqual({ kind: 'missing' })
    expect(cloudflare.calls).toHaveLength(0)
  })

  it('passes what Cloudflare passes, having sent it the secret, token and address', async () => {
    const cloudflare = cloudflareSaying({ success: true, 'error-codes': [] })

    expect(
      await checkTurnstile(
        'secret',
        'a-token',
        '203.0.113.9',
        cloudflare.fetcher,
      ),
    ).toEqual({ kind: 'passed' })

    expect(cloudflare.calls).toHaveLength(1)
    expect(cloudflare.calls[0].url).toBe(VERIFY_URL)
    expect(cloudflare.calls[0].form.get('secret')).toBe('secret')
    expect(cloudflare.calls[0].form.get('response')).toBe('a-token')
    expect(cloudflare.calls[0].form.get('remoteip')).toBe('203.0.113.9')
  })

  it('leaves the address out when Cloudflare never set one', async () => {
    const cloudflare = cloudflareSaying({ success: true })
    await checkTurnstile('secret', 'a-token', 'unknown', cloudflare.fetcher)
    expect(cloudflare.calls[0].form.has('remoteip')).toBe(false)
  })

  it('fails with the reasons Cloudflare gives', async () => {
    const cloudflare = cloudflareSaying({
      success: false,
      'error-codes': ['timeout-or-duplicate'],
    })
    expect(
      await checkTurnstile(
        'secret',
        'spent',
        '203.0.113.9',
        cloudflare.fetcher,
      ),
    ).toEqual({ kind: 'failed', codes: ['timeout-or-duplicate'] })
  })

  it('fails closed when Cloudflare cannot be reached', async () => {
    const unreachable = (async () => {
      throw new TypeError('fetch failed')
    }) as typeof fetch
    expect(
      await checkTurnstile('secret', 'a-token', '203.0.113.9', unreachable),
    ).toEqual({ kind: 'failed', codes: ['internal-error'] })
  })
})
