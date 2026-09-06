import { Effect } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  PreferencesService,
  PreferencesServiceLive,
} from '@/lib/services/preferences'
import {
  markSettingUpdated,
  readSettingEntries,
  readSettingSyncOverrides,
  setSettingSyncOverride,
  writeSettingEntries,
} from '@/lib/services/setting-sync'

/**
 * These modules read `window` and `localStorage` straight off the global
 * scope, and the unit tests run under node, so stand both up here.
 */
function installFakeStorage() {
  const entries = new Map<string, string>()
  const storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value)
    },
    removeItem: (key: string) => {
      entries.delete(key)
    },
    clear: () => {
      entries.clear()
    },
  }
  Object.assign(globalThis, { window: {}, localStorage: storage })
  return entries
}

let stored: Map<string, string>

beforeEach(() => {
  stored = installFakeStorage()
})

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window')
  Reflect.deleteProperty(globalThis, 'localStorage')
})

describe('recording when a setting changed', () => {
  it('remembers the moment, so a merge can tell which device is current', () => {
    stored.set('language', '"ja-JP"')
    markSettingUpdated('language', 1234)

    expect(readSettingEntries().language).toEqual({
      value: '"ja-JP"',
      updatedAt: 1234,
    })
  })

  it('reads a value written before timestamps existed as unknown-age, not as brand new', () => {
    stored.set('language', '"ja-JP"')

    expect(readSettingEntries().language).toEqual({
      value: '"ja-JP"',
      updatedAt: 0,
    })
  })

  it('keeps no timestamp for something that is not a setting of this app', () => {
    markSettingUpdated('authState', 1234)

    expect(stored.get('settingUpdatedAt')).toBeUndefined()
  })

  it('offers nothing for a setting the user has never touched', () => {
    expect(readSettingEntries()).toEqual({})
  })

  it('records a timestamp for every preference the app writes', () => {
    Effect.runSync(
      Effect.provide(
        Effect.gen(function* () {
          const service = yield* PreferencesService
          yield* service.setCardSize('Expanded')
        }),
        PreferencesServiceLive,
      ),
    )

    const entry = readSettingEntries().cardSize
    expect(entry?.value).toBe('"Expanded"')
    expect(entry?.updatedAt).toBeGreaterThan(0)
  })
})

describe('writing settings that came from a merge', () => {
  it('stores the value where the app already looks for it', () => {
    writeSettingEntries({ language: { value: '"en-US"', updatedAt: 42 } })

    expect(stored.get('language')).toBe('"en-US"')
  })

  it('keeps the timestamp they arrived with, so this device does not claim the change', () => {
    writeSettingEntries({ language: { value: '"en-US"', updatedAt: 42 } })

    expect(readSettingEntries().language?.updatedAt).toBe(42)
  })

  it('leaves settings the merge did not mention untouched', () => {
    stored.set('cardSize', '"Compact"')
    markSettingUpdated('cardSize', 7)

    writeSettingEntries({ language: { value: '"en-US"', updatedAt: 42 } })

    expect(readSettingEntries().cardSize).toEqual({
      value: '"Compact"',
      updatedAt: 7,
    })
  })
})

describe('the per-device sync overrides', () => {
  it('starts out empty, so every setting sits where it belongs by default', () => {
    expect(readSettingSyncOverrides()).toEqual({})
  })

  it('remembers a setting being taken out of the sync, and put back', () => {
    setSettingSyncOverride('language', true)
    expect(readSettingSyncOverrides()).toEqual({ language: true })

    setSettingSyncOverride('language', false)
    expect(readSettingSyncOverrides()).toEqual({ language: false })
  })

  it('is not itself something that can be synced', () => {
    setSettingSyncOverride('language', true)

    expect(readSettingEntries()).not.toHaveProperty('settingSyncOverrides')
    expect(readSettingEntries()).not.toHaveProperty('settingUpdatedAt')
  })

  it('ignores stored junk rather than letting it decide where a setting goes', () => {
    stored.set(
      'settingSyncOverrides',
      JSON.stringify({ language: 'yes', authState: true, cardSize: false }),
    )

    expect(readSettingSyncOverrides()).toEqual({ cardSize: false })
  })

  it('survives the value being unreadable at all', () => {
    stored.set('settingSyncOverrides', 'not json')

    expect(readSettingSyncOverrides()).toEqual({})
  })
})
