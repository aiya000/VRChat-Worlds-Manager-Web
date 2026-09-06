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

function runGetFavoriteWorlds(onProgress?: (fetched: number) => void) {
  return Effect.runPromise(
    Effect.provide(
      Effect.gen(function* () {
        const svc = yield* VRChatApiService
        return yield* svc.getFavoriteWorlds(onProgress)
      }),
      VRChatApiServiceLive,
    ),
  )
}

describe('VRChatApiService.getFavoriteWorlds', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns the favorited worlds mapped onto the app world fields', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(typeof input === 'string' ? input : input.toString())
        return new Response(JSON.stringify([vrchatWorld(0), vrchatWorld(1)]), {
          status: 200,
        })
      }),
    )

    const worlds = await runGetFavoriteWorlds()

    expect(worlds.map((w) => w.worldId)).toEqual(['wrld_0', 'wrld_1'])
    expect(worlds[0].lastUpdated).toBe('2024-05-01T12:34:56.000Z')
    expect(worlds[0].platform).toEqual(['standalonewindows'])
    expect(worlds[0].folders).toEqual([])
    // One request per page, not one per favorite: the Worker rate-limits by IP.
    expect(urls).toHaveLength(1)
    expect(urls[0]).toContain('/worlds/favorites')
  })

  it('pages until a short page comes back', async () => {
    const pageOne = Array.from({ length: 100 }, (_, i) => vrchatWorld(i))
    const pageTwo = [vrchatWorld(100)]
    const urls: string[] = []

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        urls.push(url)
        return new Response(
          JSON.stringify(url.includes('offset=100') ? pageTwo : pageOne),
          { status: 200 },
        )
      }),
    )

    const worlds = await runGetFavoriteWorlds()

    expect(worlds).toHaveLength(101)
    expect(urls).toHaveLength(2)
    expect(urls[1]).toContain('offset=100')
  })

  it('reports the running total after every page', async () => {
    const pageOne = Array.from({ length: 100 }, (_, i) => vrchatWorld(i))
    const pageTwo = [vrchatWorld(100), vrchatWorld(101)]

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString()
        return new Response(
          JSON.stringify(url.includes('offset=100') ? pageTwo : pageOne),
          { status: 200 },
        )
      }),
    )

    const reported: number[] = []
    await runGetFavoriteWorlds((fetched) => reported.push(fetched))

    expect(reported).toEqual([100, 102])
  })

  it('never reaches the VRChat API directly', async () => {
    const urls: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        urls.push(typeof input === 'string' ? input : input.toString())
        return new Response(JSON.stringify([]), { status: 200 })
      }),
    )

    await runGetFavoriteWorlds()

    for (const url of urls) {
      expect(url).not.toMatch(/vrchat\.(com|cloud)/i)
    }
  })
})
