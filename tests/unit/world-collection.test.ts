import { describe, expect, it } from 'vitest'

import type { WorldDetails } from '@/lib/types'
import { worldForCollection } from '@/lib/world-collection'

const details: WorldDetails = {
  worldId: 'wrld_1',
  name: 'PortalHeaven',
  thumbnailUrl: 'https://example.invalid/thumb.png',
  authorName: 'someone',
  authorId: 'usr_1',
  favorites: 6,
  lastUpdated: '2026-01-01',
  visits: 282,
  platform: ['standalonewindows'],
  description: 'a description the list has no room for',
  tags: ['author_tag_chill'],
  capacity: 32,
  recommendedCapacity: 16,
  publicationDate: '2025-12-01',
  releaseStatus: 'public',
}

describe('a world VRChat answered with, as the collection keeps it', () => {
  it('carries the fields a list shows', () => {
    const world = worldForCollection(details)

    expect(world).toMatchObject({
      worldId: 'wrld_1',
      name: 'PortalHeaven',
      thumbnailUrl: 'https://example.invalid/thumb.png',
      authorName: 'someone',
      favorites: 6,
      lastUpdated: '2026-01-01',
      visits: 282,
      platform: ['standalonewindows'],
      tags: ['author_tag_chill'],
      capacity: 32,
    })
  })

  it('drops what only the detail popup reads', () => {
    // `worldDetails` is where these are kept; carrying them here would be two
    // copies of the same answer, ageing apart.
    expect(worldForCollection(details)).not.toHaveProperty('authorId')
    expect(worldForCollection(details)).not.toHaveProperty('description')
    expect(worldForCollection(details)).not.toHaveProperty(
      'recommendedCapacity',
    )
    expect(worldForCollection(details)).not.toHaveProperty('publicationDate')
    expect(worldForCollection(details)).not.toHaveProperty('releaseStatus')
  })

  it('files the world nowhere', () => {
    // Having a world and putting it in a folder are separate acts.
    expect(worldForCollection(details).folders).toEqual([])
  })

  it('dates the world to now, for `rememberWorld` to overrule', () => {
    const before = Date.now()
    const added = Date.parse(worldForCollection(details).dateAdded)

    expect(added).toBeGreaterThanOrEqual(before)
    expect(added).toBeLessThanOrEqual(Date.now())
  })
})
