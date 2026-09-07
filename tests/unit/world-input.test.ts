import { describe, expect, it } from 'vitest'
import {
  instanceTypeIn,
  parseWorldReference,
  regionIn,
} from '@/lib/world-input'

const WORLD = 'wrld_12345678-1234-1234-1234-123456789abc'
const INSTANCE =
  '12345~private(usr_00000000-0000-0000-0000-000000000000)~region(jp)~nonce(abc)'

describe('parseWorldReference', () => {
  it('reads a bare world id', () => {
    expect(parseWorldReference(WORLD)).toEqual({
      worldId: WORLD,
      instanceId: null,
    })
  })

  it('reads a world page link, which names no instance', () => {
    expect(
      parseWorldReference(`https://vrchat.com/home/world/${WORLD}/info`),
    ).toEqual({ worldId: WORLD, instanceId: null })
  })

  it('reads the instance out of a launch link', () => {
    expect(
      parseWorldReference(
        `https://vrchat.com/home/launch?worldId=${WORLD}&instanceId=${encodeURIComponent(INSTANCE)}`,
      ),
    ).toEqual({ worldId: WORLD, instanceId: INSTANCE })
  })

  it('reads the pair the client scheme carries', () => {
    expect(
      parseWorldReference(
        `vrchat://launch?ref=vrchat.com&id=${WORLD}:${INSTANCE}`,
      ),
    ).toEqual({ worldId: WORLD, instanceId: INSTANCE })
  })

  it('reads the pair as this app stores it', () => {
    expect(parseWorldReference(`${WORLD}:${INSTANCE}`)).toEqual({
      worldId: WORLD,
      instanceId: INSTANCE,
    })
  })

  it('ignores the whitespace around a pasted link', () => {
    expect(parseWorldReference(`  ${WORLD}  `)?.worldId).toBe(WORLD)
  })

  it('refuses text that names no world', () => {
    expect(parseWorldReference('https://vrchat.com/home')).toBeNull()
    expect(parseWorldReference('wrld_not-a-real-id')).toBeNull()
    expect(parseWorldReference('')).toBeNull()
  })
})

// VRChat spells the kind of an instance in modifiers rather than in a field of
// its own, and the client's words for them are not the modifiers' words.
describe('instanceTypeIn', () => {
  it('calls an id with no modifier public', () => {
    expect(instanceTypeIn('12345')).toBe('public')
  })

  it('tells invite from invite+ by whether an invite may be requested', () => {
    expect(instanceTypeIn('12345~private(usr_1)~region(jp)')).toBe('invite')
    expect(
      instanceTypeIn('12345~private(usr_1)~canRequestInvite~region(jp)'),
    ).toBe('invite+')
  })

  it('reads hidden as friends+ and friends as friends', () => {
    expect(instanceTypeIn('12345~hidden(usr_1)~region(jp)')).toBe('friends+')
    expect(instanceTypeIn('12345~friends(usr_1)~region(jp)')).toBe('friends')
  })

  it('reads a group instance', () => {
    expect(
      instanceTypeIn('12345~group(grp_1)~groupAccessType(plus)~region(jp)'),
    ).toBe('group')
  })
})

describe('regionIn', () => {
  it('reads the region the id names', () => {
    expect(regionIn('12345~private(usr_1)~region(eu)')).toBe('eu')
  })

  it('treats a missing region as us, which is what VRChat means by it', () => {
    expect(regionIn('12345')).toBe('us')
  })
})
