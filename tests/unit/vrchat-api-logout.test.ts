import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import {
  VRChatApiService,
  VRChatApiServiceLive,
} from '@/lib/services/vrchat-api'

type Call = { url: string; method: string }

function stubFetch(respond: (call: Call) => Response): { calls: Call[] } {
  const calls: Call[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call: Call = {
        url: typeof input === 'string' ? input : input.toString(),
        method: init?.method ?? 'GET',
      }
      calls.push(call)
      return respond(call)
    }),
  )
  return { calls }
}

function runToErrorMessage(
  effect: Effect.Effect<void, Error, VRChatApiService>,
): Promise<string | null> {
  return Effect.runPromise(
    Effect.provide(effect, VRChatApiServiceLive).pipe(
      Effect.map(() => null),
      Effect.catchAll((e: Error) => Effect.succeed(e.message)),
    ),
  )
}

function logout() {
  return runToErrorMessage(
    Effect.gen(function* () {
      const svc = yield* VRChatApiService
      yield* svc.logout()
    }),
  )
}

/**
 * Puts a session in hand the way signing in does, through the header the
 * Worker hands the tokens over in.
 */
async function signIn(token: string) {
  await runToErrorMessage(
    Effect.gen(function* () {
      const svc = yield* VRChatApiService
      yield* svc.tryLogin()
    }),
  )
  // The stub answering `/auth/user` carries the header; nothing else to do.
  return token
}

function loggedOutCalls(calls: Call[]): string[] {
  return calls
    .filter((call) => call.url.endsWith('/logout'))
    .map((call) => call.method)
}

describe('logging out of VRChat', () => {
  // The session lives in a module-level cache, so each test starts by
  // dropping whatever the last one left behind. A logout clears it whether or
  // not it had anything to clear.
  beforeEach(async () => {
    stubFetch(() => new Response('', { status: 401 }))
    await logout()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('ends the session VRChat still knows about', async () => {
    const { calls } = stubFetch((call) =>
      call.url.endsWith('/auth/user')
        ? new Response(
            JSON.stringify({ id: 'usr_0', displayName: 'Someone' }),
            { status: 200, headers: { 'X-VRC-Auth': 'authcookie_abc' } },
          )
        : new Response('', { status: 200 }),
    )
    await signIn('authcookie_abc')

    expect(await logout()).toBe(null)
    expect(loggedOutCalls(calls)).toEqual(['PUT'])
  })

  it('counts a session VRChat has already forgotten as logged out', async () => {
    const { calls } = stubFetch((call) =>
      call.url.endsWith('/auth/user')
        ? new Response(
            JSON.stringify({ id: 'usr_0', displayName: 'Someone' }),
            { status: 200, headers: { 'X-VRC-Auth': 'authcookie_stale' } },
          )
        : new Response(
            JSON.stringify({
              error: { message: 'Missing Credentials', status_code: 401 },
            }),
            { status: 401 },
          ),
    )
    await signIn('authcookie_stale')

    // The whole point: an hour-old session, or one dropped by clearing the
    // browser's storage, used to report a failure the person could not get
    // past -- and the screen stayed looking signed in.
    expect(await logout()).toBe(null)
    expect(loggedOutCalls(calls)).toEqual(['PUT'])
  })

  it('asks VRChat nothing when no session is held', async () => {
    const { calls } = stubFetch(() => new Response('', { status: 200 }))

    expect(await logout()).toBe(null)
    expect(calls).toHaveLength(0)
  })

  it('still reports a logout VRChat refused for another reason', async () => {
    const { calls } = stubFetch((call) =>
      call.url.endsWith('/auth/user')
        ? new Response(
            JSON.stringify({ id: 'usr_0', displayName: 'Someone' }),
            { status: 200, headers: { 'X-VRC-Auth': 'authcookie_abc' } },
          )
        : new Response('', { status: 500 }),
    )
    await signIn('authcookie_abc')

    expect(await logout()).toMatch(/500/)
    expect(loggedOutCalls(calls)).toEqual(['PUT'])
  })

  it('drops the session locally even when the request failed', async () => {
    stubFetch((call) =>
      call.url.endsWith('/auth/user')
        ? new Response(
            JSON.stringify({ id: 'usr_0', displayName: 'Someone' }),
            { status: 200, headers: { 'X-VRC-Auth': 'authcookie_abc' } },
          )
        : new Response('', { status: 500 }),
    )
    await signIn('authcookie_abc')
    await logout()
    vi.restoreAllMocks()

    // Nothing is left to log out of, so the second press asks nothing and
    // succeeds rather than repeating the error.
    const { calls } = stubFetch(() => new Response('', { status: 500 }))
    expect(await logout()).toBe(null)
    expect(calls).toHaveLength(0)
  })
})
