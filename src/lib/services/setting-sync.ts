import { notifyLocalChange } from './local-changes'
import { notifyPreferencesChanged } from './preferences-changed'
import {
  isSyncableSettingKey,
  SYNCABLE_SETTING_KEYS,
  type SettingEntries,
  type SettingSyncOverrides,
  type SyncableSettingKey,
} from '@/lib/sync/settings'
import type { SettingsOverride } from '@/lib/sync/types'

/** When each syncable setting was last written here, keyed by setting name. */
const UPDATED_AT_KEY = 'settingUpdatedAt'

/** Keys whose sync class this device has been told to flip. Never synced. */
const SYNC_OVERRIDES_KEY = 'settingSyncOverrides'

/** A demand made here that has not reached Drive yet. */
const PENDING_OVERRIDE_KEY = 'pendingSettingsOverride'

/** The `at` of the newest demand this device has already obeyed. */
const APPLIED_OVERRIDE_AT_KEY = 'appliedSettingsOverrideAt'

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

  // Nothing watches local storage, and the screens that read these values read
  // them once. Without this a sync that worked leaves the app looking exactly
  // as it did before it ran.
  if (Object.keys(entries).length > 0) {
    notifyPreferencesChanged()
  }
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
  // Turning "this device only" off changes what this device publishes just as
  // surely as editing the setting would. Without this the new classification
  // waited for the next edit or the next press, which reads on screen as the
  // toggle having done nothing at all.
  notifyLocalChange()
}

/**
 * Asks that this device's settings replace every other device's, once.
 *
 * It is recorded rather than acted on: the demand has to travel in the next
 * snapshot, and only a sync can carry it. Its `at` is written straight into
 * "already obeyed" as well, so this device never hands its own demand back to
 * itself when the file comes round again.
 *
 * Nothing is awaited here, and that is deliberate rather than incidental: this
 * runs inside the click that goes on to ask Google for a token, and a token
 * request that has lost its user gesture is a window that never opens. The
 * device id the demand travels under is filled in where the snapshot is built,
 * which is somewhere an await is free.
 */
export function requestSettingsOverride(at: number = Date.now()): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(PENDING_OVERRIDE_KEY, JSON.stringify({ at }))
  rememberAppliedSettingsOverride(at)
  notifyLocalChange()
}

/** When a demand was made here, or `null` if none is waiting. */
export function readPendingSettingsOverrideAt(): number | null {
  const stored = readJson<Record<string, unknown>>(PENDING_OVERRIDE_KEY, {})
  const { at } = stored
  return typeof at === 'number' ? at : null
}

/** Called once the demand has actually reached Drive. */
export function clearPendingSettingsOverride(): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.removeItem(PENDING_OVERRIDE_KEY)
}

export function readAppliedSettingsOverrideAt(): number {
  if (typeof window === 'undefined') {
    return 0
  }
  const at = Number(localStorage.getItem(APPLIED_OVERRIDE_AT_KEY))
  return Number.isFinite(at) ? at : 0
}

export function rememberAppliedSettingsOverride(at: number): void {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(APPLIED_OVERRIDE_AT_KEY, String(at))
}

/**
 * Whether a snapshot's demand is one this device still owes.
 *
 * A demand is obeyed once and then remembered, because the marker stays in the
 * file: obeying it on every later sync would quietly undo every setting anyone
 * changed afterwards.
 */
export function shouldObeySettingsOverride(
  override: SettingsOverride | null,
  localDeviceId: string,
): boolean {
  if (override === null || override.origin === localDeviceId) {
    return false
  }
  return override.at > readAppliedSettingsOverrideAt()
}
