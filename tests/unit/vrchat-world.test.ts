import { describe, expect, it } from 'vitest'
import {
  parseVRChatWorld,
  toWorldDisplayData,
} from '@/lib/services/vrchat-world'

function vrchatWorld(overrides: Record<string, unknown> = {}) {
  return {
    id: 'wrld_1',
    name: 'Test World',
    description: 'A world',
    authorId: 'usr_1',
    authorName: 'Author',
    capacity: 32,
    recommendedCapacity: 16,
    imageUrl: 'https://example.com/image.png',
    thumbnailImageUrl: 'https://example.com/thumbnail.png',
    tags: ['author_tag_a', 'system_approved'],
    favorites: 5,
    visits: 100,
    created_at: '2024-01-01T00:00:00.000Z',
    updated_at: '2024-05-01T12:34:56.000Z',
    publicationDate: '2024-01-02T00:00:00.000Z',
    unityPackages: [
      { platform: 'standalonewindows', unityVersion: '2022.3.22f1' },
      { platform: 'standalonewindows', unityVersion: '2019.4.31f1' },
      { platform: 'android', unityVersion: '2022.3.22f1' },
    ],
    ...overrides,
  }
}

describe('parseVRChatWorld', () => {
  it('maps VRChat field names onto the app world fields', () => {
    const world = parseVRChatWorld(vrchatWorld())

    expect(world.worldId).toBe('wrld_1')
    expect(world.lastUpdated).toBe('2024-05-01T12:34:56.000Z')
    expect(world.thumbnailUrl).toBe('https://example.com/thumbnail.png')
    expect(world.authorName).toBe('Author')
    expect(world.capacity).toBe(32)
    expect(world.recommendedCapacity).toBe(16)
    expect(world.favorites).toBe(5)
    expect(world.visits).toBe(100)
    expect(world.tags).toEqual(['author_tag_a', 'system_approved'])
  })

  it('reads the release status VRChat reports', () => {
    expect(
      parseVRChatWorld(vrchatWorld({ releaseStatus: 'private' })).releaseStatus,
    ).toBe('private')
    expect(
      parseVRChatWorld(vrchatWorld({ releaseStatus: 'public' })).releaseStatus,
    ).toBe('public')
  })

  it('calls a missing or unrecognised release status unknown, not public', () => {
    // Absent is not the same as public: only what VRChat actually said should
    // decide whether a world is shown as private.
    expect(parseVRChatWorld(vrchatWorld()).releaseStatus).toBe('unknown')
    expect(
      parseVRChatWorld(vrchatWorld({ releaseStatus: 'somethingNew' }))
        .releaseStatus,
    ).toBe('unknown')
  })

  it('derives the platforms from unityPackages without duplicates', () => {
    expect(parseVRChatWorld(vrchatWorld()).platform).toEqual([
      'standalonewindows',
      'android',
    ])
  })

  it('reports an unrecognised platform rather than dropping it', () => {
    const world = parseVRChatWorld(
      vrchatWorld({ unityPackages: [{ platform: 'someconsole' }] }),
    )

    expect(world.platform).toEqual(['unknownplatform'])
  })

  it('falls back to imageUrl when no thumbnail is offered', () => {
    const world = parseVRChatWorld(
      vrchatWorld({ thumbnailImageUrl: undefined }),
    )

    expect(world.thumbnailUrl).toBe('https://example.com/image.png')
  })

  it('tolerates a payload missing the optional fields', () => {
    const world = parseVRChatWorld({ id: 'wrld_2', name: 'Bare' })

    expect(world.worldId).toBe('wrld_2')
    expect(world.platform).toEqual([])
    expect(world.tags).toEqual([])
    expect(world.visits).toBe(0)
    expect(world.recommendedCapacity).toBe(null)
    expect(world.publicationDate).toBe(null)
  })

  it('rejects a payload that is not a world object', () => {
    expect(() => parseVRChatWorld(['not', 'a', 'world'])).toThrow()
    expect(() => parseVRChatWorld(null)).toThrow()
  })
})

describe('toWorldDisplayData', () => {
  it('carries the world over with the given local-only fields', () => {
    const display = toWorldDisplayData(
      parseVRChatWorld(vrchatWorld()),
      '2024-06-01T00:00:00.000Z',
      ['Favorites'],
    )

    expect(display.worldId).toBe('wrld_1')
    expect(display.lastUpdated).toBe('2024-05-01T12:34:56.000Z')
    expect(display.dateAdded).toBe('2024-06-01T00:00:00.000Z')
    expect(display.folders).toEqual(['Favorites'])
  })
})
