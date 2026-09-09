import { Context, Effect } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  PreferencesService,
  PreferencesServiceLive,
} from '@/lib/services/preferences'
import { settingSyncClass } from '@/lib/sync/settings'

/**
 * The preferences service reads `window` and `localStorage` straight off the
 * global scope, and the unit tests run under node, so stand both up here.
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

type Preferences = Context.Tag.Service<typeof PreferencesService>

function run<A>(effect: (service: Preferences) => Effect.Effect<A>) {
  return Effect.runSync(
    Effect.provide(
      Effect.gen(function* () {
        const service = yield* PreferencesService
        return yield* effect(service)
      }),
      PreferencesServiceLive,
    ),
  )
}

/**
 * The two switches for worlds kept only because an instance was made in them
 * (#173). Both start off, so by default such a world appears nowhere: not in
 * "all worlds", and not as anything on the search page.
 */
describe('showing worlds kept only for an instance', () => {
  beforeEach(() => {
    installFakeStorage()
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window')
    Reflect.deleteProperty(globalThis, 'localStorage')
  })

  it('is off until asked for, on the list and on the search page alike', () => {
    expect(run((s) => s.getShowWorldsKeptForInstance())).toBe(false)
    expect(run((s) => s.getMarkWorldsKeptForInstanceOnFind())).toBe(false)
  })

  it('reads back what was chosen, each switch on its own', () => {
    run((s) => s.setShowWorldsKeptForInstance(true))

    expect(run((s) => s.getShowWorldsKeptForInstance())).toBe(true)
    expect(run((s) => s.getMarkWorldsKeptForInstanceOnFind())).toBe(false)

    run((s) => s.setMarkWorldsKeptForInstanceOnFind(true))
    run((s) => s.setShowWorldsKeptForInstance(false))

    expect(run((s) => s.getShowWorldsKeptForInstance())).toBe(false)
    expect(run((s) => s.getMarkWorldsKeptForInstanceOnFind())).toBe(true)
  })

  it('follows the person from device to device', () => {
    // The whitelist in `sync/settings.ts` is what lets a key travel at all; a
    // key left out of it never reaches a snapshot.
    expect(settingSyncClass('showWorldsKeptForInstance', {})).toBe('synced')
    expect(settingSyncClass('markWorldsKeptForInstanceOnFind', {})).toBe(
      'synced',
    )
  })
})
