export type Result<T, E> =
  | { status: 'ok'; data: T }
  | { status: 'error'; error: E }

export type BackupMetaData = {
  date: string
  number_of_folders: number
  number_of_worlds: number
  app_version: string
}

export type CardSize = 'Compact' | 'Normal' | 'Expanded' | 'Original'

export type FilterItemSelectorStarredType =
  | 'Author'
  | 'Tag'
  | 'ExcludeTag'
  | 'Folder'

export type FolderData = { name: string; world_count: number }

export type FolderRemovalPreference = 'ask' | 'alwaysRemove' | 'neverRemove'

export type WorldCardFieldVisibility = {
  name: boolean
  authorName: boolean
  visits: boolean
  lastUpdated: boolean
  favorites: boolean
}

export type WorldDetailFieldVisibility = {
  visits: boolean
  favorites: boolean
  capacity: boolean
  published: boolean
  lastUpdated: boolean
}

export type GroupInstanceCreateAllowedType = {
  normal: boolean
  plus: boolean
  public: boolean
  restricted: boolean
}

export type GroupInstanceCreatePermission =
  | { Allowed: GroupInstanceCreateAllowedType }
  | 'NotAllowed'

export type GroupInstancePermissionInfo = {
  permission: GroupInstanceCreatePermission
  roles: GroupRole[]
}

export type GroupMemberVisibility = 'visible' | 'friends' | 'hidden'

export type GroupPermission =
  | '*'
  | 'group-announcement-manage'
  | 'group-audit-view'
  | 'group-bans-manage'
  | 'group-data-manage'
  | 'group-default-role-manage'
  | 'group-galleries-manage'
  | 'group-instance-age-gated-create'
  | 'group-instance-join'
  | 'group-instance-manage'
  | 'group-instance-moderate'
  | 'group-instance-open-create'
  | 'group-instance-plus-create'
  | 'group-instance-plus-portal'
  | 'group-instance-plus-portal-unlocked'
  | 'group-instance-public-create'
  | 'group-instance-queue-priority'
  | 'group-instance-restricted-create'
  | 'group-invites-manage'
  | 'group-members-manage'
  | 'group-members-remove'
  | 'group-members-viewall'
  | 'group-roles-assign'
  | 'group-roles-manage'

export type GroupRole = {
  id: string
  groupId: string
  name: string
  permissions: GroupPermission[]
  isManagementRole: boolean
}

export type InstanceInfo = {
  world_id: string
  instance_id: string
  short_name: string | null
}

export type InstanceRegion = 'us' | 'use' | 'eu' | 'jp'

export type PatreonData = {
  platinumSupporter: string[]
  goldSupporter: string[]
  silverSupporter: string[]
  bronzeSupporter: string[]
  basicSupporter: string[]
}

export type PatreonVRChatNames = {
  platinumSupporter: string[]
  goldSupporter: string[]
  silverSupporter: string[]
  bronzeSupporter: string[]
  basicSupporter: string[]
}

export type Platform =
  | 'standalonewindows'
  | 'android'
  | 'ios'
  | 'unknownplatform'

export type PreviousMetadata = {
  number_of_folders: number
  number_of_worlds: number
}

export type TaskStatus = 'Running' | 'Completed' | 'Cancelled' | 'Failed'

export type TaskStatusChanged = { id: string; status: TaskStatus }

export type UserGroup = {
  id: string
  name: string
  shortCode: string
  discriminator: string
  description: string
  iconUrl?: string | null
  bannerUrl?: string | null
  privacy: string
  memberCount: number
  groupId: string
  memberVisibility: GroupMemberVisibility
  isRepresenting: boolean
  mutualGroup: boolean
}

export type WorldBlacklist = { worlds: string[] }

/**
 * How VRChat has published a world.
 *
 * `unknown` is what a world stored before this field existed reads as, and
 * what a world VRChat would not describe has: not knowing is not the same as
 * being public, and only `private` should be shown as private.
 */
export type WorldReleaseStatus =
  | 'public'
  | 'private'
  | 'hidden'
  | 'all'
  | 'unknown'

export type WorldDetails = {
  worldId: string
  name: string
  thumbnailUrl: string
  authorName: string
  authorId: string
  favorites: number
  lastUpdated: string
  visits: number
  platform: Platform[]
  description: string
  tags: string[]
  capacity: number
  recommendedCapacity: number | null
  publicationDate: string | null
  releaseStatus: WorldReleaseStatus
}

export type WorldDisplayData = {
  worldId: string
  name: string
  thumbnailUrl: string
  authorName: string
  favorites: number
  lastUpdated: string
  visits: number
  dateAdded: string
  platform: Platform[]
  folders: string[]
  tags: string[]
  capacity: number
}
