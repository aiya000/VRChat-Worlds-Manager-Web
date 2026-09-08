import { afterEach, describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import {
  VRChatApiService,
  VRChatApiServiceLive,
} from '@/lib/services/vrchat-api'

function vrchatWorld(index: number) {
  return {
    id: `wrld_${index}`,
    name: `World ${index}`,
    authorName: 'Author',
    capacity: 16,
    thumbnailImageUrl: `https://example.com/${index}.png`,
    tags: [],
    favorites: index,
    visits: index * 10,
    updated_at: '2024-05-01T12:34:56.000Z',
    unityPackages: [{ platform: 'standalonewindows' }],
  }
}

function runGetRecentlyVisitedWorlds() {
  return Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        return yield* svc.getRecentlyVisitedWorlds()
      }),
      VRChatApiServiceLive,
    ),
  )
}

function answerWith(body: unknown, urls: string[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      urls.push(typeof input === 'string' ? input : input.toString())
      return new Response(JSON.stringify(body), { status: 200 })
    }),
  )
}

describe('VRChatApiService.getRecentlyVisitedWorlds', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('asks for the visit history, not for the worlds the account uploaded', async () => {
    const urls: string[] = []
    answerWith([vrchatWorld(0)], urls)

    await runGetRecentlyVisitedWorlds()

    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain('/worlds/recent')
    // `user=me` is "worlds I have uploaded", which is empty for most accounts.
    expect(urls[0]).not.toContain('user=me')
  })

  it('maps the answer onto the app world fields', async () => {
    const urls: string[] = []
    answerWith([vrchatWorld(0), vrchatWorld(1)], urls)

    const worlds = await runGetRecentlyVisitedWorlds()

    expect(worlds.map((w) => w.worldId)).toEqual(['wrld_0', 'wrld_1'])
    expect(worlds[0].lastUpdated).toBe('2024-05-01T12:34:56.000Z')
    expect(worlds[0].platform).toEqual(['standalonewindows'])
    expect(worlds[0].folders).toEqual([])
  })

  it('never reaches the VRChat API directly', async () => {
    const urls: string[] = []
    answerWith([], urls)

    await runGetRecentlyVisitedWorlds()

    for (const url of urls) {
      expect(url).not.toMatch(/vrchat\.(com|cloud)/i)
    }
  })
})
