import { afterEach, describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import {
  VRChatApiService,
  VRChatApiServiceLive,
  WorldFetchError,
} from '@/lib/services/vrchat-api'

/** Runs `getWorld` expecting it to fail, and hands the failure back as the value. */
function failureOf(worldId: string): Promise<WorldFetchError> {
  return Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        return yield* svc.getWorld(worldId)
      }).pipe(Effect.flip),
      VRChatApiServiceLive,
    ),
  )
}

function answerWith(status: number, body: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(body, { status })),
  )
}

describe('VRChatApiService.getWorld failures', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('tells a deleted or unknown world by the 404', async () => {
    answerWith(
      404,
      JSON.stringify({
        error: { message: '"World wrld_gone not found"', status_code: 404 },
      }),
    )

    const failure = await failureOf('wrld_gone')

    expect(failure.kind).toBe('not-found')
    expect(failure.status).toBe(404)
    expect(failure.message).toContain('wrld_gone not found')
  })

  it('tells a private world by its wording, whatever the status', async () => {
    answerWith(
      401,
      JSON.stringify({
        error: { message: '"World is not public"', status_code: 401 },
      }),
    )

    const failure = await failureOf('wrld_private')

    expect(failure.kind).toBe('not-public')
    expect(failure.status).toBe(401)
  })

  it('tells a request that never got an answer from a refused one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch')
      }),
    )

    const failure = await failureOf('wrld_offline')

    expect(failure.kind).toBe('network')
    expect(failure.status).toBeNull()
  })

  it('keeps any other answer as "other", with the body for the report', async () => {
    answerWith(500, 'upstream exploded')

    const failure = await failureOf('wrld_any')

    expect(failure.kind).toBe('other')
    expect(failure.status).toBe(500)
    expect(failure.message).toContain('upstream exploded')
  })
})
