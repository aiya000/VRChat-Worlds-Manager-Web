import { afterEach, describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import {
  VRChatApiService,
  VRChatApiServiceLive,
} from '@/lib/services/vrchat-api'
import type { SearchablePlatform } from '@/lib/platform-filter'

function runSearchWorlds(platforms: SearchablePlatform[]) {
  return Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        return yield* svc.searchWorlds('popularity', [], [], '', 1, platforms)
      }),
      VRChatApiServiceLive,
    ),
  )
}

function answerWithNothing(urls: string[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      urls.push(typeof input === 'string' ? input : input.toString())
      return new Response('[]', { status: 200 })
    }),
  )
}

function platformParams(url: string): string[] {
  return new URL(url, 'https://example.com').searchParams.getAll('platform')
}

describe('the platform VRChat is asked about when searching', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('asks about no platform when none is checked', async () => {
    const urls: string[] = []
    answerWithNothing(urls)

    await runSearchWorlds([])

    expect(platformParams(urls[0])).toEqual([])
  })

  it('asks about the checked platform', async () => {
    const urls: string[] = []
    answerWithNothing(urls)

    await runSearchWorlds(['android'])

    expect(platformParams(urls[0])).toEqual(['android'])
  })

  it('never sends two values, which VRChat answers with an empty list', async () => {
    const urls: string[] = []
    answerWithNothing(urls)

    await runSearchWorlds(['standalonewindows', 'android'])

    const values = platformParams(urls[0])
    expect(values).toHaveLength(1)
    expect(values[0]).not.toContain(',')
    // The narrower of the two, so the page comes back least diluted.
    expect(values[0]).toBe('android')
  })
})
