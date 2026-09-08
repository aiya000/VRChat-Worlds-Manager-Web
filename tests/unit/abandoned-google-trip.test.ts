import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { abandonGoogleTrip } from '@/lib/services/abandoned-google-trip'
import { GOOGLE_AUTH_PENDING_RETURN_KEY } from '@/lib/google-auth-flow'
import {
  endSync,
  syncActivity,
  tryBeginSync,
} from '@/lib/services/sync-activity'

function stubLocalStorage(initial: Record<string, string>) {
  const store = new Map(Object.entries(initial))
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    removeItem: (key: string) => store.delete(key),
  })
  return store
}

/** What `leaveForGoogle` writes down before the page goes. */
const PENDING_RETURN = JSON.stringify({
  state: 'abc',
  intent: 'sync',
  returnTo: '/listview/folders/special/all',
  startedAt: Date.now(),
})

describe('a departure for Google that the browser undid', () => {
  beforeEach(() => {
    // The claim and the last-synced time are module state, shared by every
    // test in this file.
    endSync(null)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lets the next press sync again', () => {
    stubLocalStorage({ [GOOGLE_AUTH_PENDING_RETURN_KEY]: PENDING_RETURN })

    // A press leaves for Google holding the claim, and on purpose does not
    // give it back: the page is supposed to be gone. Back from the
    // back/forward cache, this is the state that is still there.
    expect(tryBeginSync()).toBe(true)
    expect(tryBeginSync()).toBe(false)

    abandonGoogleTrip()

    expect(tryBeginSync()).toBe(true)
  })

  it('forgets where the trip was going', () => {
    const store = stubLocalStorage({
      [GOOGLE_AUTH_PENDING_RETURN_KEY]: PENDING_RETURN,
    })
    tryBeginSync()

    abandonGoogleTrip()

    expect(store.has(GOOGLE_AUTH_PENDING_RETURN_KEY)).toBe(false)
  })

  it('does not claim anything synced', () => {
    stubLocalStorage({ [GOOGLE_AUTH_PENDING_RETURN_KEY]: PENDING_RETURN })
    // A sync that did finish earlier in this tab.
    tryBeginSync()
    endSync(1_700_000_000_000)
    tryBeginSync()

    abandonGoogleTrip()

    expect(syncActivity()).toEqual({
      running: false,
      lastSyncedAt: 1_700_000_000_000,
    })
  })

  it('is harmless when there was no departure to give up', () => {
    const store = stubLocalStorage({})

    abandonGoogleTrip()

    expect(syncActivity().running).toBe(false)
    expect(store.size).toBe(0)
  })
})
