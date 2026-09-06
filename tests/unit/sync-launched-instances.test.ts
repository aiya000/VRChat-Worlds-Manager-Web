import { describe, expect, it } from 'vitest'

import {
  beyondTheLimit,
  launchedInstanceId,
  launchUrlFor,
  instanceTypeLabelKey,
  LAUNCHED_INSTANCES_PER_WORLD,
  newestFirst,
  regionLabel,
} from '@/lib/sync/launched-instances'
import { mergeLaunchedInstance, mergeSnapshot } from '@/lib/sync/merge'
import type { LaunchedInstanceSyncRecord, Snapshot } from '@/lib/sync/types'
import { emptySnapshot } from '@/lib/sync/merge'

const WORLD = 'wrld_1234'

function instance(
  overrides: Partial<LaunchedInstanceSyncRecord> & { id: string },
): LaunchedInstanceSyncRecord {
  return {
    worldId: WORLD,
    instanceId: overrides.id.split(':')[1] ?? '1',
    shortName: null,
    instanceType: 'public',
    region: 'jp',
    launchedAt: 100,
    updatedAt: 100,
    deletedAt: null,
    origin: 'device-a',
    ...overrides,
  }
}

function snapshotWith(
  instances: LaunchedInstanceSyncRecord[],
  deviceId: string,
): Snapshot {
  return { ...emptySnapshot(deviceId), launchedInstances: instances }
}

describe('a launch URL', () => {
  it('is built from the two ids and nothing else', () => {
    expect(launchUrlFor(WORLD, '12345~region(jp)')).toBe(
      'vrchat://launch?ref=vrchat.com&id=wrld_1234:12345~region(jp)',
    )
  })

  it('is keyed the same way the saved row is, so one names the other', () => {
    expect(launchUrlFor(WORLD, '99')).toContain(launchedInstanceId(WORLD, '99'))
  })
})

describe('ordering saved instances', () => {
  it('puts the most recent first', () => {
    const ordered = newestFirst([
      instance({ id: 'a', launchedAt: 1 }),
      instance({ id: 'b', launchedAt: 3 }),
      instance({ id: 'c', launchedAt: 2 }),
    ])
    expect(ordered.map((row) => row.id)).toEqual(['b', 'c', 'a'])
  })

  it('breaks a tie the same way on every device', () => {
    const ordered = newestFirst([
      instance({ id: 'z', launchedAt: 5 }),
      instance({ id: 'a', launchedAt: 5 }),
    ])
    expect(ordered.map((row) => row.id)).toEqual(['a', 'z'])
  })

  it('leaves the list it was given alone', () => {
    const rows = [
      instance({ id: 'a', launchedAt: 1 }),
      instance({ id: 'b', launchedAt: 3 }),
    ]
    newestFirst(rows)
    expect(rows.map((row) => row.id)).toEqual(['a', 'b'])
  })
})

describe('keeping the list bounded', () => {
  it('gives up the oldest once there are more than the limit', () => {
    const rows = [
      instance({ id: 'old', launchedAt: 1 }),
      instance({ id: 'mid', launchedAt: 2 }),
      instance({ id: 'new', launchedAt: 3 }),
    ]
    expect(beyondTheLimit(rows, 2).map((row) => row.id)).toEqual(['old'])
  })

  it('gives up nothing while the list is within the limit', () => {
    const rows = [
      instance({ id: 'a', launchedAt: 1 }),
      instance({ id: 'b', launchedAt: 2 }),
    ]
    expect(beyondTheLimit(rows, 2)).toEqual([])
  })

  it('keeps several by default, because an old instance is usually closed', () => {
    expect(LAUNCHED_INSTANCES_PER_WORLD).toBeGreaterThan(1)
  })
})

describe('merging one instance', () => {
  it('keeps the moment it was made, not the later claim', () => {
    const merged = mergeLaunchedInstance(
      instance({ id: 'a', launchedAt: 500, updatedAt: 900 }),
      instance({ id: 'a', launchedAt: 100, updatedAt: 200 }),
    )
    expect(merged.launchedAt).toBe(100)
  })

  it('lets a tombstone win, so pruning on one device prunes everywhere', () => {
    const merged = mergeLaunchedInstance(
      instance({ id: 'a', updatedAt: 100 }),
      instance({ id: 'a', updatedAt: 300, deletedAt: 300 }),
    )
    expect(merged.deletedAt).toBe(300)
  })

  it('does not let an old tombstone remove an instance made since', () => {
    const merged = mergeLaunchedInstance(
      instance({ id: 'a', updatedAt: 900 }),
      instance({ id: 'a', updatedAt: 100, deletedAt: 100 }),
    )
    expect(merged.deletedAt).toBeNull()
  })
})

describe('merging two devices together', () => {
  it('keeps the instances both of them made', () => {
    const { snapshot } = mergeSnapshot(
      snapshotWith([instance({ id: 'from-desktop' })], 'device-a'),
      snapshotWith([instance({ id: 'from-vr' })], 'device-b'),
    )
    expect(snapshot.launchedInstances.map((row) => row.id).sort()).toEqual([
      'from-desktop',
      'from-vr',
    ])
  })

  it('carries an instance the other device has never seen', () => {
    const { snapshot } = mergeSnapshot(
      snapshotWith([], 'device-a'),
      snapshotWith([instance({ id: 'only-there' })], 'device-b'),
    )
    expect(snapshot.launchedInstances).toHaveLength(1)
  })

  it('does not lose them when a backup that predates the field is taken in', () => {
    const older = emptySnapshot('device-b')
    const { snapshot } = mergeSnapshot(
      snapshotWith([instance({ id: 'kept' })], 'device-a'),
      older,
    )
    expect(snapshot.launchedInstances.map((row) => row.id)).toEqual(['kept'])
  })
})

describe('how a saved instance is spelled', () => {
  it('uses the words the instance-type buttons already use', () => {
    expect(instanceTypeLabelKey('friends+')).toBe('world-detail:friends-plus')
    expect(instanceTypeLabelKey('invite')).toBe('world-detail:invite')
    expect(instanceTypeLabelKey('public')).toBe('world-detail:public')
  })

  it('has no word for a type nobody has translated, rather than a wrong one', () => {
    expect(instanceTypeLabelKey('group+')).toBeNull()
    expect(instanceTypeLabelKey('something-vrchat-adds-later')).toBeNull()
  })

  it('spells a region the way the buttons that pick one do', () => {
    expect(regionLabel('us')).toBe('USW')
    expect(regionLabel('use')).toBe('USE')
    expect(regionLabel('jp')).toBe('JP')
  })

  it('shows an unknown region rather than pretending it is Japan', () => {
    expect(regionLabel('mars')).toBe('MARS')
  })
})
