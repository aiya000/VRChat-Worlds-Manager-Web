/**
 * What a pasted world reference resolves to.
 *
 * `instanceId` is present when the text names one -- a launch link, or the
 * `world:instance` pair the app stores -- and `null` for a plain world link,
 * which names no instance at all.
 */
export interface WorldReference {
  worldId: string
  instanceId: string | null
}

const WORLD_ID =
  /wrld_[a-zA-Z0-9]{8}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{4}-[a-zA-Z0-9]{12}/

/**
 * The world, and the instance if the text carries one.
 *
 * Every form VRChat hands out points at the same pair, so they are read here
 * rather than each caller learning them again:
 *
 * - `wrld_...`, on its own
 * - `wrld_...:12345~private(usr_...)~region(jp)`, the pair as this app stores it
 * - `https://vrchat.com/home/world/wrld_.../info`
 * - `https://vrchat.com/home/launch?worldId=wrld_...&instanceId=...`
 * - `vrchat://launch?ref=vrchat.com&id=wrld_...:12345~...`
 *
 * The instance is worth keeping because a world that is not public can only be
 * entered through one: its id is all the launch URL is built from, and VRChat's
 * API is asked for nothing.
 */
export function parseWorldReference(input: string): WorldReference | null {
  const cleaned = input.trim()
  const worldId = cleaned.match(WORLD_ID)?.[0]
  if (worldId === undefined) {
    return null
  }

  return { worldId, instanceId: instanceIdIn(cleaned, worldId) }
}

function instanceIdIn(cleaned: string, worldId: string): string | null {
  // A launch link names it in its own parameter, percent-encoded: the id holds
  // `(`, `)` and `~`, which a browser escapes when it builds the link.
  const named = cleaned.match(/[?&]instanceId=([^&#\s]+)/)
  if (named !== null) {
    return decodeURIComponent(named[1]) || null
  }

  // Otherwise it follows the world id after a colon, which is how both
  // `vrchat://launch?id=` and this app's own stored id are shaped.
  const afterWorldId = cleaned.slice(cleaned.indexOf(worldId) + worldId.length)
  const joined = afterWorldId.match(/^:([^&#\s/]+)/)
  return joined === null ? null : decodeURIComponent(joined[1]) || null
}

/**
 * What kind of instance the id describes, in the vocabulary the rest of the app
 * shows -- `instanceTypeLabelKey` takes exactly these.
 *
 * VRChat spells the kind in modifiers rather than in a field: `private(...)`
 * with `canRequestInvite` is what the client calls invite+, and the same
 * without it is invite. An id with no modifier at all is a public instance.
 */
export function instanceTypeIn(instanceId: string): string {
  if (/~group\(/.test(instanceId)) {
    return 'group'
  }
  if (/~private\(/.test(instanceId)) {
    return /~canRequestInvite\b/.test(instanceId) ? 'invite+' : 'invite'
  }
  if (/~hidden\(/.test(instanceId)) {
    return 'friends+'
  }
  if (/~friends\(/.test(instanceId)) {
    return 'friends'
  }
  return 'public'
}

/**
 * The region the id names, or `us` -- which is what VRChat means by leaving it
 * out, rather than "unknown".
 */
export function regionIn(instanceId: string): string {
  return instanceId.match(/~region\(([^)]+)\)/)?.[1] ?? 'us'
}
