import type { FilterItemSelectorStarredType } from '@/lib/types'
import type { SyncedSetting } from './types'

export type SettingSyncClass = 'synced' | 'deviceOnly'

/**
 * Every setting that is allowed to travel between devices, and where each one
 * belongs by default.
 *
 * This is a whitelist rather than a list of exclusions on purpose: a key that
 * nobody remembered to classify never reaches a snapshot at all, so a setting
 * added later that happens to hold something private cannot leak by omission.
 * `setupComplete` and the whole `authState` table are outside it deliberately.
 *
 * The split is "does this follow the person, or the screen they are looking
 * at": language and sorting follow the person, while card size and which
 * fields a card shows are chosen for the display in front of them -- a phone
 * and a VR overlay want different answers.
 */
export const DEFAULT_SETTING_SYNC_CLASSES = {
  theme: 'synced',
  language: 'synced',
  region: 'synced',
  instanceType: 'synced',
  sortPreferences: 'synced',
  folderRemovalPreference: 'synced',
  starredFilterItems_Author: 'synced',
  starredFilterItems_Tag: 'synced',
  starredFilterItems_ExcludeTag: 'synced',
  starredFilterItems_Folder: 'synced',
  cardSize: 'deviceOnly',
  worldCardFieldVisibility: 'deviceOnly',
  worldDetailFieldVisibility: 'deviceOnly',
} as const satisfies Record<string, SettingSyncClass>

export type SyncableSettingKey = keyof typeof DEFAULT_SETTING_SYNC_CLASSES

export const SYNCABLE_SETTING_KEYS = Object.keys(
  DEFAULT_SETTING_SYNC_CLASSES,
) as SyncableSettingKey[]

/**
 * Spelled out through a `Record` of the starred type so that adding a new kind
 * of starred filter fails to compile until its key is classified above, rather
 * than silently going unsynced.
 */
const starredFilterSettingKeys: Record<
  FilterItemSelectorStarredType,
  SyncableSettingKey
> = {
  Author: 'starredFilterItems_Author',
  Tag: 'starredFilterItems_Tag',
  ExcludeTag: 'starredFilterItems_ExcludeTag',
  Folder: 'starredFilterItems_Folder',
}

export function starredFilterSettingKey(
  id: FilterItemSelectorStarredType,
): SyncableSettingKey {
  return starredFilterSettingKeys[id]
}

export function isSyncableSettingKey(key: string): key is SyncableSettingKey {
  return key in DEFAULT_SETTING_SYNC_CLASSES
}

/**
 * What this device has been told about keys whose class differs from the
 * default. `true` means "this device only". Kept per device and never synced
 * itself -- otherwise turning sync off for a setting on one device would turn
 * it off everywhere, which is the opposite of what the toggle promises.
 */
export type SettingSyncOverrides = Partial<Record<SyncableSettingKey, boolean>>

export function settingSyncClass(
  key: SyncableSettingKey,
  overrides: SettingSyncOverrides,
): SettingSyncClass {
  const override = overrides[key]
  if (override === undefined) {
    return DEFAULT_SETTING_SYNC_CLASSES[key]
  }
  return override ? 'deviceOnly' : 'synced'
}

export function isDeviceOnlySetting(
  key: SyncableSettingKey,
  overrides: SettingSyncOverrides,
): boolean {
  return settingSyncClass(key, overrides) === 'deviceOnly'
}

export interface SettingEntry {
  /** The stored string exactly as it sits in local storage. */
  value: string
  updatedAt: number
}

export type SettingEntries = Partial<Record<SyncableSettingKey, SettingEntry>>

/**
 * `next-themes` owns the `theme` key and writes it bare, while this app's own
 * preference writer JSON-encodes what it stores -- so the same theme can be on
 * disk as either `dark` or `"dark"`. The snapshot carries the bare form, and
 * writing it back that way keeps `next-themes` able to read it.
 */
export function canonicalizeSettingValue(
  key: SyncableSettingKey,
  value: string,
): string {
  if (key !== 'theme') {
    return value
  }
  return value.startsWith('"') && value.endsWith('"')
    ? value.slice(1, -1)
    : value
}

/**
 * The settings this device is willing to publish. Anything the user marked as
 * "this device only" is not merely ignored on the way in -- it never leaves
 * here in the first place.
 */
export function selectSyncedSettings(
  entries: SettingEntries,
  overrides: SettingSyncOverrides,
): Record<string, SyncedSetting> {
  const published: Record<string, SyncedSetting> = {}

  for (const key of SYNCABLE_SETTING_KEYS) {
    const entry = entries[key]
    if (entry === undefined || isDeviceOnlySetting(key, overrides)) {
      continue
    }
    published[key] = {
      value: canonicalizeSettingValue(key, entry.value),
      updatedAt: entry.updatedAt,
    }
  }

  return published
}

/**
 * Which of an incoming snapshot's settings should actually be written here.
 *
 * A key this device treats as its own is dropped even when the snapshot
 * carries it, because the other device may well classify it as synced -- the
 * classification belongs to the device doing the reading, not to the file.
 */
export function selectSettingsToApply(
  incoming: Record<string, SyncedSetting>,
  local: SettingEntries,
  overrides: SettingSyncOverrides,
): SettingEntries {
  const toWrite: SettingEntries = {}

  for (const [key, setting] of Object.entries(incoming)) {
    if (!isSyncableSettingKey(key) || isDeviceOnlySetting(key, overrides)) {
      continue
    }

    const value = canonicalizeSettingValue(key, setting.value)
    const current = local[key]
    if (current !== undefined) {
      if (setting.updatedAt < current.updatedAt) {
        continue
      }
      if (canonicalizeSettingValue(key, current.value) === value) {
        continue
      }
    }

    toWrite[key] = { value, updatedAt: setting.updatedAt }
  }

  return toWrite
}
