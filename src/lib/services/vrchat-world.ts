import type {
  Platform,
  WorldDetails,
  WorldDisplayData,
  WorldReleaseStatus,
} from '@/lib/types'

const platformAliases: Record<string, Platform> = {
  standalonewindows: 'standalonewindows',
  pc: 'standalonewindows',
  android: 'android',
  quest: 'android',
  ios: 'ios',
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('The VRChat API returned something that is not a world')
  }
  return value as Record<string, unknown>
}

function optionalString(entry: Record<string, unknown>, key: string): string {
  const value = entry[key]
  return typeof value === 'string' ? value : ''
}

function nullableString(
  entry: Record<string, unknown>,
  key: string,
): string | null {
  const value = entry[key]
  return typeof value === 'string' ? value : null
}

function optionalNumber(entry: Record<string, unknown>, key: string): number {
  const value = entry[key]
  return typeof value === 'number' ? value : 0
}

function nullableNumber(
  entry: Record<string, unknown>,
  key: string,
): number | null {
  const value = entry[key]
  return typeof value === 'number' ? value : null
}

function optionalStringArray(
  entry: Record<string, unknown>,
  key: string,
): string[] {
  const value = entry[key]
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string')
}

const releaseStatuses: WorldReleaseStatus[] = [
  'public',
  'private',
  'hidden',
  'all',
]

function parseReleaseStatus(
  entry: Record<string, unknown>,
): WorldReleaseStatus {
  const value = entry['releaseStatus']
  const known = releaseStatuses.find((status) => status === value)
  return known ?? 'unknown'
}

// VRChat reports the supported platforms only indirectly, as one Unity package
// per platform, so the same platform usually appears several times.
function parsePlatforms(entry: Record<string, unknown>): Platform[] {
  const packages = entry['unityPackages']
  if (!Array.isArray(packages)) {
    return []
  }
  const platforms: Platform[] = []
  for (const unityPackage of packages) {
    if (typeof unityPackage !== 'object' || unityPackage === null) {
      continue
    }
    const raw = (unityPackage as Record<string, unknown>)['platform']
    if (typeof raw !== 'string') {
      continue
    }
    const platform = platformAliases[raw.toLowerCase()] ?? 'unknownplatform'
    if (!platforms.includes(platform)) {
      platforms.push(platform)
    }
  }
  return platforms
}

/**
 * VRChat's world JSON does not use this app's field names -- the ID is `id`,
 * the timestamp is `updated_at`, and the platforms have to be derived from
 * `unityPackages`. Casting a response straight to `WorldDetails`, as every
 * caller used to do, therefore left those fields `undefined`.
 */
export function parseVRChatWorld(value: unknown): WorldDetails {
  const entry = asRecord(value)
  const thumbnail = optionalString(entry, 'thumbnailImageUrl')
  return {
    worldId: optionalString(entry, 'id'),
    name: optionalString(entry, 'name'),
    thumbnailUrl:
      thumbnail === '' ? optionalString(entry, 'imageUrl') : thumbnail,
    authorName: optionalString(entry, 'authorName'),
    authorId: optionalString(entry, 'authorId'),
    favorites: optionalNumber(entry, 'favorites'),
    lastUpdated: optionalString(entry, 'updated_at'),
    visits: optionalNumber(entry, 'visits'),
    platform: parsePlatforms(entry),
    description: optionalString(entry, 'description'),
    tags: optionalStringArray(entry, 'tags'),
    capacity: optionalNumber(entry, 'capacity'),
    recommendedCapacity: nullableNumber(entry, 'recommendedCapacity'),
    publicationDate: nullableString(entry, 'publicationDate'),
    releaseStatus: parseReleaseStatus(entry),
  }
}

export function toWorldDisplayData(
  world: WorldDetails,
  dateAdded: string,
  folders: string[],
): WorldDisplayData {
  return {
    worldId: world.worldId,
    name: world.name,
    thumbnailUrl: world.thumbnailUrl,
    authorName: world.authorName,
    favorites: world.favorites,
    lastUpdated: world.lastUpdated,
    visits: world.visits,
    dateAdded,
    platform: world.platform,
    folders,
    tags: world.tags,
    capacity: world.capacity,
  }
}
