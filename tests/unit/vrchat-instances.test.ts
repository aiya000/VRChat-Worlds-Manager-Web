import { describe, expect, it } from 'vitest'

import { instanceRequestBody, parseInstanceInfo } from '@/lib/vrchat-instances'

const WORLD = 'wrld_1234'
const ME = 'usr_me'

describe('what is sent to make an instance', () => {
  it('speaks the API’s names, not the buttons’', () => {
    // "Invite" sent as it is came back as `type must be one of [...], not
    // "invite"`; this is the table the desktop app used to carry.
    expect(instanceRequestBody(WORLD, 'friends+', 'jp', ME).type).toBe('hidden')
    expect(instanceRequestBody(WORLD, 'friends', 'jp', ME).type).toBe('friends')
    expect(instanceRequestBody(WORLD, 'invite+', 'jp', ME).type).toBe('private')
    expect(instanceRequestBody(WORLD, 'invite', 'jp', ME).type).toBe('private')
    expect(instanceRequestBody(WORLD, 'public', 'jp', ME).type).toBe('public')
  })

  it('tells the two private kinds apart by whether an invite can be asked for', () => {
    expect(
      instanceRequestBody(WORLD, 'invite+', 'jp', ME).canRequestInvite,
    ).toBe(true)
    expect(
      instanceRequestBody(WORLD, 'invite', 'jp', ME).canRequestInvite,
    ).toBe(false)
  })

  it('names the owner for every kind that has one', () => {
    for (const kind of ['friends+', 'friends', 'invite+', 'invite'] as const) {
      expect(instanceRequestBody(WORLD, kind, 'eu', ME).ownerId).toBe(ME)
    }
    expect(instanceRequestBody(WORLD, 'public', 'eu', ME)).not.toHaveProperty(
      'ownerId',
    )
  })

  it('carries the world and region through untouched', () => {
    expect(instanceRequestBody(WORLD, 'friends', 'use', ME)).toMatchObject({
      worldId: WORLD,
      region: 'use',
    })
  })
})

describe('reading the instance VRChat answers with', () => {
  it('takes the camelCase fields the API actually sends', () => {
    expect(
      parseInstanceInfo({
        id: `${WORLD}:12345~region(jp)`,
        worldId: WORLD,
        instanceId: '12345~region(jp)',
        shortName: 'abc123',
        region: 'jp',
      }),
    ).toEqual({
      world_id: WORLD,
      instance_id: '12345~region(jp)',
      short_name: 'abc123',
    })
  })

  it('has no short name rather than a wrong one', () => {
    expect(
      parseInstanceInfo({ worldId: WORLD, instanceId: '1', shortName: null })
        .short_name,
    ).toBeNull()
    expect(
      parseInstanceInfo({ worldId: WORLD, instanceId: '1' }).short_name,
    ).toBeNull()
  })

  it('refuses an answer with no ids, rather than remembering undefined', () => {
    // Reading the JSON through the snake_case type is how a launch URL came
    // to say `id=undefined:undefined`.
    expect(() =>
      parseInstanceInfo({ world_id: WORLD, instance_id: '1' }),
    ).toThrow()
    expect(() => parseInstanceInfo(null)).toThrow()
  })
})
