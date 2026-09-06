import { describe, expect, it } from 'vitest'

import {
  canonicalizeSettingValue,
  isSyncableSettingKey,
  selectSettingsToApply,
  selectSyncedSettings,
  settingSyncClass,
  starredFilterSettingKey,
  SYNCABLE_SETTING_KEYS,
  type SettingEntries,
} from '@/lib/sync/settings'

describe('the whitelist of settings that may travel', () => {
  it('leaves out the ones that must never be shared', () => {
    expect(isSyncableSettingKey('setupComplete')).toBe(false)
    expect(isSyncableSettingKey('authState')).toBe(false)
    expect(isSyncableSettingKey('settingUpdatedAt')).toBe(false)
    expect(isSyncableSettingKey('settingSyncOverrides')).toBe(false)
  })

  it('treats a setting nobody classified as unshareable rather than shareable', () => {
    expect(isSyncableSettingKey('somethingAddedNextYear')).toBe(false)
  })

  it('carries every starred filter kind', () => {
    for (const id of ['Author', 'Tag', 'ExcludeTag', 'Folder'] as const) {
      expect(SYNCABLE_SETTING_KEYS).toContain(starredFilterSettingKey(id))
    }
  })
})

describe('where each setting belongs by default', () => {
  it('sends the ones that follow the person', () => {
    expect(settingSyncClass('language', {})).toBe('synced')
    expect(settingSyncClass('theme', {})).toBe('synced')
    expect(settingSyncClass('sortPreferences', {})).toBe('synced')
    expect(settingSyncClass('starredFilterItems_Author', {})).toBe('synced')
  })

  it('keeps the ones chosen for the screen in front of the user', () => {
    expect(settingSyncClass('cardSize', {})).toBe('deviceOnly')
    expect(settingSyncClass('worldCardFieldVisibility', {})).toBe('deviceOnly')
    expect(settingSyncClass('worldDetailFieldVisibility', {})).toBe(
      'deviceOnly',
    )
  })
})

describe('the "only on this device" toggle', () => {
  it('takes a synced setting out of the sync', () => {
    expect(settingSyncClass('language', { language: true })).toBe('deviceOnly')
  })

  it('also works the other way, promoting a device setting into the sync', () => {
    expect(settingSyncClass('cardSize', { cardSize: false })).toBe('synced')
  })
})

describe('selectSyncedSettings', () => {
  const entries: SettingEntries = {
    language: { value: '"ja-JP"', updatedAt: 5 },
    cardSize: { value: '"Compact"', updatedAt: 7 },
    theme: { value: 'dark', updatedAt: 9 },
  }

  it('publishes the synced ones with their timestamps', () => {
    expect(selectSyncedSettings(entries, {})).toEqual({
      language: { value: '"ja-JP"', updatedAt: 5 },
      theme: { value: 'dark', updatedAt: 9 },
    })
  })

  it('never publishes a device-only setting at all', () => {
    expect(selectSyncedSettings(entries, {})).not.toHaveProperty('cardSize')
  })

  it('stops publishing a setting the moment it is marked as this device only', () => {
    expect(
      selectSyncedSettings(entries, { language: true }),
    ).not.toHaveProperty('language')
  })

  it('skips settings this device has never written', () => {
    expect(selectSyncedSettings({}, {})).toEqual({})
  })

  it('publishes the theme in the form next-themes writes', () => {
    const quoted: SettingEntries = { theme: { value: '"dark"', updatedAt: 1 } }
    expect(selectSyncedSettings(quoted, {})).toEqual({
      theme: { value: 'dark', updatedAt: 1 },
    })
  })
})

describe('selectSettingsToApply', () => {
  it('writes a setting this device has never had', () => {
    expect(
      selectSettingsToApply(
        { language: { value: '"en-US"', updatedAt: 3 } },
        {},
        {},
      ),
    ).toEqual({ language: { value: '"en-US"', updatedAt: 3 } })
  })

  it('keeps the incoming timestamp rather than claiming the change as its own', () => {
    const applied = selectSettingsToApply(
      { language: { value: '"en-US"', updatedAt: 3 } },
      {},
      {},
    )
    expect(applied.language?.updatedAt).toBe(3)
  })

  it('takes a newer setting over the one already here', () => {
    expect(
      selectSettingsToApply(
        { language: { value: '"en-US"', updatedAt: 9 } },
        { language: { value: '"ja-JP"', updatedAt: 4 } },
        {},
      ),
    ).toEqual({ language: { value: '"en-US"', updatedAt: 9 } })
  })

  it('leaves an older setting alone', () => {
    expect(
      selectSettingsToApply(
        { language: { value: '"en-US"', updatedAt: 1 } },
        { language: { value: '"ja-JP"', updatedAt: 4 } },
        {},
      ),
    ).toEqual({})
  })

  it('writes nothing when the value is already what arrived', () => {
    expect(
      selectSettingsToApply(
        { language: { value: '"ja-JP"', updatedAt: 9 } },
        { language: { value: '"ja-JP"', updatedAt: 4 } },
        {},
      ),
    ).toEqual({})
  })

  it('honours a merge that resolved a same-instant disagreement', () => {
    expect(
      selectSettingsToApply(
        { language: { value: '"en-US"', updatedAt: 4 } },
        { language: { value: '"ja-JP"', updatedAt: 4 } },
        {},
      ),
    ).toEqual({ language: { value: '"en-US"', updatedAt: 4 } })
  })

  it('drops a key this device keeps to itself, even though the file carries it', () => {
    expect(
      selectSettingsToApply(
        { cardSize: { value: '"Expanded"', updatedAt: 9 } },
        { cardSize: { value: '"Compact"', updatedAt: 1 } },
        {},
      ),
    ).toEqual({})
  })

  it('drops a key the user has just marked as this device only', () => {
    expect(
      selectSettingsToApply(
        { language: { value: '"en-US"', updatedAt: 9 } },
        { language: { value: '"ja-JP"', updatedAt: 1 } },
        { language: true },
      ),
    ).toEqual({})
  })

  it('ignores a key that is not a setting of this app', () => {
    expect(
      selectSettingsToApply(
        { authState: { value: 'a-token', updatedAt: 9 } },
        {},
        {},
      ),
    ).toEqual({})
  })

  it('does not rewrite the theme just because one side quoted it', () => {
    expect(
      selectSettingsToApply(
        { theme: { value: 'dark', updatedAt: 9 } },
        { theme: { value: '"dark"', updatedAt: 1 } },
        {},
      ),
    ).toEqual({})
  })

  it('writes the theme in the form next-themes can read', () => {
    expect(
      selectSettingsToApply(
        { theme: { value: '"light"', updatedAt: 9 } },
        { theme: { value: 'dark', updatedAt: 1 } },
        {},
      ),
    ).toEqual({ theme: { value: 'light', updatedAt: 9 } })
  })
})

describe('canonicalizeSettingValue', () => {
  it('unwraps the theme, which next-themes stores bare', () => {
    expect(canonicalizeSettingValue('theme', '"dark"')).toBe('dark')
    expect(canonicalizeSettingValue('theme', 'dark')).toBe('dark')
  })

  it('leaves every other setting exactly as stored', () => {
    expect(canonicalizeSettingValue('language', '"ja-JP"')).toBe('"ja-JP"')
    expect(canonicalizeSettingValue('sortPreferences', '["name","asc"]')).toBe(
      '["name","asc"]',
    )
  })
})
