import { describe, expect, it } from 'vitest'

import { hasUnsyncedChanges } from '@/lib/sync/unsynced-changes'

describe('whether the sync button has something to send', () => {
  it('has nothing on a device that never changed anything', () => {
    expect(hasUnsyncedChanges(null, null)).toBe(false)
    expect(hasUnsyncedChanges(null, 1_000)).toBe(false)
  })

  it('has something once a change is newer than the last sync', () => {
    expect(hasUnsyncedChanges(2_000, 1_000)).toBe(true)
  })

  it('has something when a change was made and no sync has ever run', () => {
    expect(hasUnsyncedChanges(2_000, null)).toBe(true)
  })

  it('has nothing once a sync has caught up', () => {
    expect(hasUnsyncedChanges(1_000, 1_000)).toBe(false)
    expect(hasUnsyncedChanges(1_000, 2_000)).toBe(false)
  })
})
