import { notifyLocalChange } from './local-changes'
import {
  isSyncableSettingKey,
  SYNCABLE_SETTING_KEYS,
  type SettingEntries,
  type SettingSyncOverrides,
  type SyncableSettingKey,
} from '@/lib/sync/settings'

/** When each syncable setting was last written here, keyed by setting name. */
const UPDATED_AT_KEY = 'settingUpdatedAt'

/** Keys whose sync class this device has been told to flip. Never synced. */
const SYNC_OVERRIDES_KEY = 'settingSyncOverrides'

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') {
    return fallback
  }
  const raw = localStorage.getItem(key)
  if (raw === null) {
    return fallback
  }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object') {
      return fallback
    }
    return parsed as T
  } catch {
    return fallback
  }
}

function readUpdatedAtMap(): Partial<Record<SyncableSettingKey, number>> {
  const stored = readJson<Record<string, unknown>>(UPDATED_AT_KEY, {})
  const map: Partial<Record<SyncableSettingKey, number>> = {}

  for (const [key, value] of Object.entries(stored)) {
    if (isSyncableSettingKey(key) && typeof value === 'number') {
      map[key] = value
    }
  }

  return map
}

function writeUpdatedAt(key: SyncableSettingKey, at: number): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(
    UPDATED_AT_KEY,
    JSON.stringify({ ...readUpdatedAtMap(), [key]: at }),
  )
}

/**
 * Records that a setting changed just now.
 *
 * Without this every setting would look equally old and a merge would have no
 * way to tell which device's answer is the current one, so this has to run on
 * every write -- which is why it lives inside the preference writer rather
 * than being something callers remember to do.
 */
export function markSettingUpdated(key: string, at: number = Date.now()): void {
  if (!isSyncableSettingKey(key)) {
    return
  }
  writeUpdatedAt(key, at)
  // Settings live in local storage rather than in Dexie, so the change signal
  // the automatic sync watches has to be raised by hand here.
  notifyLocalChange()
}

export function readSettingEntries(): SettingEntries {
  if (typeof window === 'undefined') {
    return {}
  }

  const updatedAt = readUpdatedAtMap()
  const entries: SettingEntries = {}

  for (const key of SYNCABLE_SETTING_KEYS) {
    const value = localStorage.getItem(key)
    if (value === null) {
      continue
    }
    // A value written before this device started keeping timestamps is real
    // but of unknown age, so it is offered to a merge as the oldest thing
    // there is rather than as a change made now.
    entries[key] = { value, updatedAt: updatedAt[key] ?? 0 }
  }

  return entries
}

/**
 * Writes settings that came from a merge, keeping the timestamp they arrived
 * with. Stamping them with the current time instead would make this device
 * claim it had just changed everything, and it would win the next merge
 * against the device the values actually came from.
 */
export function writeSettingEntries(entries: SettingEntries): void {
  if (typeof window === 'undefined') {
    return
  }

  const updatedAt = readUpdatedAtMap()
  for (const key of SYNCABLE_SETTING_KEYS) {
    const entry = entries[key]
    if (entry === undefined) {
      continue
    }
    localStorage.setItem(key, entry.value)
    updatedAt[key] = entry.updatedAt
  }

  localStorage.setItem(UPDATED_AT_KEY, JSON.stringify(updatedAt))
}

export function readSettingSyncOverrides(): SettingSyncOverrides {
  const stored = readJson<Record<string, unknown>>(SYNC_OVERRIDES_KEY, {})
  const overrides: SettingSyncOverrides = {}

  for (const [key, value] of Object.entries(stored)) {
    if (isSyncableSettingKey(key) && typeof value === 'boolean') {
      overrides[key] = value
    }
  }

  return overrides
}

export function setSettingSyncOverride(
  key: SyncableSettingKey,
  deviceOnly: boolean,
): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(
    SYNC_OVERRIDES_KEY,
    JSON.stringify({ ...readSettingSyncOverrides(), [key]: deviceOnly }),
  )
}
