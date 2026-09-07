import { afterEach, describe, expect, it, vi } from 'vitest'

import { discardCachedBundle } from '@/lib/stale-bundle'

type FakeRegistration = { unregister: () => Promise<boolean> }

function stubServiceWorker(registrations: FakeRegistration[]) {
  vi.stubGlobal('navigator', {
    serviceWorker: {
      getRegistrations: async () => registrations,
    },
  })
}

function stubCaches(names: string[]) {
  const deleted: string[] = []
  vi.stubGlobal('caches', {
    keys: async () => names,
    delete: async (name: string) => {
      deleted.push(name)
      return true
    },
  })
  return deleted
}

describe('escaping a bundle that is being served from a cache', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('unregisters every worker and drops every cache', async () => {
    const unregistered: string[] = []
    stubServiceWorker([
      {
        unregister: async () => {
          unregistered.push('one')
          return true
        },
      },
      {
        unregister: async () => {
          unregistered.push('two')
          return true
        },
      },
    ])
    const deleted = stubCaches(['vrcww-v1', 'vrcww-abc123'])

    await discardCachedBundle()

    // Both, not just the one this build would have made: the one still
    // answering is by definition the one this build did not make.
    expect(unregistered).toEqual(['one', 'two'])
    expect(deleted).toEqual(['vrcww-v1', 'vrcww-abc123'])
  })

  it('still drops the caches when a worker refuses to go', async () => {
    stubServiceWorker([
      { unregister: async () => Promise.reject(new Error('nope')) },
    ])
    const deleted = stubCaches(['vrcww-v1'])

    // The reload afterwards is the only part that can help on its own, so a
    // step that throws must not take the rest of the escape down with it.
    await expect(discardCachedBundle()).resolves.toBeUndefined()
    expect(deleted).toEqual(['vrcww-v1'])
  })

  it('still unregisters the workers when the caches cannot be read', async () => {
    const unregistered: string[] = []
    stubServiceWorker([
      {
        unregister: async () => {
          unregistered.push('one')
          return true
        },
      },
    ])
    vi.stubGlobal('caches', {
      keys: async () => Promise.reject(new Error('denied')),
      delete: async () => true,
    })

    await expect(discardCachedBundle()).resolves.toBeUndefined()
    expect(unregistered).toEqual(['one'])
  })

  it('does nothing at all in a browser without either', async () => {
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('caches', undefined)

    await expect(discardCachedBundle()).resolves.toBeUndefined()
  })
})
