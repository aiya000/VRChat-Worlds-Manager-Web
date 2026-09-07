import type { InstanceInfo, InstanceRegion } from '@/lib/types'
import type { InstanceType } from '@/types/instances'

/**
 * The body `POST /instances` wants for an instance a person owns.
 *
 * The buttons speak VRChat's user-facing names and the API speaks older ones:
 * "Friends+" is `hidden`, and both "Invite" and "Invite+" are `private`,
 * told apart by `canRequestInvite`. Sending the button's word as it is gets
 * `type must be one of [...], not "invite"` back. The desktop app carried this
 * table in Rust and it was lost in the move to the web.
 *
 * `ownerId` is the person making the instance for every type but public: the
 * API wants to know whose friends "friends" means.
 */
export function instanceRequestBody(
  worldId: string,
  instanceType: Exclude<InstanceType, 'group'>,
  region: InstanceRegion,
  ownerId: string,
): Record<string, unknown> {
  const body = { worldId, region }
  switch (instanceType) {
    case 'public':
      return { ...body, type: 'public' }
    case 'friends+':
      return { ...body, type: 'hidden', ownerId }
    case 'friends':
      return { ...body, type: 'friends', ownerId }
    case 'invite+':
      return { ...body, type: 'private', ownerId, canRequestInvite: true }
    case 'invite':
      return { ...body, type: 'private', ownerId, canRequestInvite: false }
  }
}

/**
 * The parts of VRChat's `Instance` object this app keeps.
 *
 * VRChat answers in camelCase. `InstanceInfo` is spelled the way the desktop
 * app's Rust structs were, and reading the JSON through that type without
 * renaming anything left every field `undefined` -- which is how a launch
 * URL came to say `id=undefined:undefined`.
 */
export function parseInstanceInfo(json: unknown): InstanceInfo {
  if (typeof json !== 'object' || json === null) {
    throw new Error('Instance response is not an object')
  }
  const record = json as Record<string, unknown>
  const worldId = record['worldId']
  const instanceId = record['instanceId']
  const shortName = record['shortName']
  if (typeof worldId !== 'string' || typeof instanceId !== 'string') {
    throw new Error('Instance response has no worldId or instanceId')
  }
  return {
    world_id: worldId,
    instance_id: instanceId,
    short_name: typeof shortName === 'string' ? shortName : null,
  }
}
