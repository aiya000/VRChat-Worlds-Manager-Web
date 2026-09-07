import { describe, expect, it } from 'vitest'
import {
  emptySnapshot,
  isMember,
  mergeFolderOrder,
  mergeSet,
  mergeSnapshot,
} from '@/lib/sync/merge'
import { SEED_TIMESTAMP, type Snapshot } from '@/lib/sync/types'

const PHONE = 'device-phone'
const DESKTOP = 'device-desktop'

function snapshot(deviceId: string, parts: Partial<Snapshot>): Snapshot {
  return { ...emptySnapshot(deviceId), ...parts }
}

function world(
  worldId: string,
  parts: Partial<Snapshot['worlds'][number]> = {},
): Snapshot['worlds'][number] {
  return {
    worldId,
    dateAdded: '2025-01-01T00:00:00.000Z',
    folderRefs: [],
    seed: null,
    updatedAt: SEED_TIMESTAMP,
    deletedAt: null,
    origin: '',
    ...parts,
  }
}

function folder(
  id: string,
  name: string,
  parts: Partial<Snapshot['folders'][number]> = {},
): Snapshot['folders'][number] {
  return {
    id,
    name,
    updatedAt: SEED_TIMESTAMP,
    deletedAt: null,
    origin: '',
    ...parts,
  }
}

function memo(
  worldId: string,
  text: string,
  parts: Partial<Snapshot['memos'][number]> = {},
): Snapshot['memos'][number] {
  return {
    worldId,
    memo: text,
    conflictBackup: null,
    updatedAt: SEED_TIMESTAMP,
    deletedAt: null,
    origin: '',
    ...parts,
  }
}

function ref(
  folderId: string,
  addedAt: number,
  removedAt: number | null = null,
) {
  return { folderId, addedAt, removedAt }
}

/** The merge stamps a fresh date on every result, so ignore it when comparing. */
function withoutDate(snap: Snapshot) {
  return { ...snap, metadata: { ...snap.metadata, date: '' } }
}

function folderIdsOf(snap: Snapshot, worldId: string): string[] {
  const found = snap.worlds.find((w) => w.worldId === worldId)
  if (found === undefined) {
    throw new Error(`world ${worldId} is not in the snapshot`)
  }
  return found.folderRefs
    .filter(isMember)
    .map((r) => r.folderId)
    .sort()
}

describe('mergeSet', () => {
  it('keeps both memberships when two devices file the same world differently', () => {
    const merged = mergeSet(
      [ref('sightseeing', 100)],
      [ref('funny', 200)],
      (r) => r.folderId,
    )

    expect(
      merged
        .filter(isMember)
        .map((r) => r.folderId)
        .sort(),
    ).toEqual(['funny', 'sightseeing'])
  })

  it('honours a removal that is newer than the addition it undoes', () => {
    const merged = mergeSet(
      [ref('sightseeing', 100)],
      [ref('sightseeing', 100, 200)],
      (r) => r.folderId,
    )

    expect(merged.filter(isMember)).toEqual([])
  })

  it('honours an addition that is newer than the removal it undoes', () => {
    const merged = mergeSet(
      [ref('sightseeing', 300, 200)],
      [ref('sightseeing', 100, 200)],
      (r) => r.folderId,
    )

    expect(merged.filter(isMember).map((r) => r.folderId)).toEqual([
      'sightseeing',
    ])
  })

  it('leaves the element a member when the two stamps tie', () => {
    const merged = mergeSet(
      [ref('sightseeing', 100)],
      [ref('sightseeing', 0, 100)],
      (r) => r.folderId,
    )

    expect(merged.filter(isMember).map((r) => r.folderId)).toEqual([
      'sightseeing',
    ])
  })
})

describe('mergeSnapshot: folder assignments', () => {
  it('does not let one device overwrite the folder the other chose', () => {
    const local = snapshot(PHONE, {
      folders: [folder('f-sight', '観光', { updatedAt: 10, origin: PHONE })],
      worlds: [
        world('wrld_a', {
          folderRefs: [ref('f-sight', 100)],
          updatedAt: 100,
          origin: PHONE,
        }),
      ],
    })
    const remote = snapshot(DESKTOP, {
      folders: [folder('f-funny', 'ネタ', { updatedAt: 10, origin: DESKTOP })],
      worlds: [
        world('wrld_a', {
          folderRefs: [ref('f-funny', 200)],
          updatedAt: 200,
          origin: DESKTOP,
        }),
      ],
    })

    const { snapshot: merged } = mergeSnapshot(local, remote)

    expect(folderIdsOf(merged, 'wrld_a')).toEqual(['f-funny', 'f-sight'])
  })

  it('gives the world the earlier of the two dateAdded values', () => {
    const local = snapshot(PHONE, {
      worlds: [
        world('wrld_a', {
          dateAdded: '2025-06-01T00:00:00.000Z',
          updatedAt: 900,
          origin: PHONE,
        }),
      ],
    })
    const remote = snapshot(DESKTOP, {
      worlds: [
        world('wrld_a', {
          dateAdded: '2025-01-15T00:00:00.000Z',
          updatedAt: 100,
          origin: DESKTOP,
        }),
      ],
    })

    const { snapshot: merged } = mergeSnapshot(local, remote)

    expect(merged.worlds[0].dateAdded).toBe('2025-01-15T00:00:00.000Z')
  })
})

describe('mergeSnapshot: rows nobody has timestamps for', () => {
  it('unions two independently migrated devices instead of picking a winner', () => {
    const local = snapshot(PHONE, {
      folders: [folder('local-sight', '観光')],
      worlds: [world('wrld_a', { folderRefs: [ref('local-sight', 0)] })],
    })
    const remote = snapshot(DESKTOP, {
      folders: [folder('remote-sight', '観光'), folder('remote-fun', 'ネタ')],
      worlds: [
        world('wrld_a', {
          folderRefs: [ref('remote-sight', 0), ref('remote-fun', 0)],
        }),
      ],
    })

    const { snapshot: merged, folderIdRemapping } = mergeSnapshot(local, remote)

    // The same folder name on both sides is one folder, not two.
    expect(folderIdRemapping).toEqual({ 'remote-sight': 'local-sight' })
    expect(merged.folders.map((f) => f.name).sort()).toEqual(['ネタ', '観光'])
    expect(folderIdsOf(merged, 'wrld_a')).toEqual(['local-sight', 'remote-fun'])
  })

  it('refuses to delete a row on the say-so of only one side', () => {
    const local = snapshot(PHONE, {
      worlds: [world('wrld_a', { deletedAt: null })],
    })
    const remote = snapshot(DESKTOP, {
      worlds: [world('wrld_a', { deletedAt: SEED_TIMESTAMP })],
    })

    const { snapshot: merged } = mergeSnapshot(local, remote)

    expect(merged.worlds[0].deletedAt).toBeNull()
  })

  it('keeps the deletion when both sides carry the same tombstone', () => {
    const local = snapshot(PHONE, {
      worlds: [world('wrld_a', { deletedAt: SEED_TIMESTAMP })],
    })
    const remote = snapshot(DESKTOP, {
      worlds: [world('wrld_a', { deletedAt: SEED_TIMESTAMP })],
    })

    const { snapshot: merged } = mergeSnapshot(local, remote)

    expect(merged.worlds[0].deletedAt).toBe(SEED_TIMESTAMP)
  })

  it('keeps a folder assignment that only the other device knows about', () => {
    const local = snapshot(PHONE, {
      folders: [folder('f-a', '観光')],
      worlds: [world('wrld_a', { folderRefs: [ref('f-a', SEED_TIMESTAMP)] })],
    })
    const remote = snapshot(DESKTOP, {
      folders: [folder('f-b', 'ネタ')],
      worlds: [world('wrld_a', { folderRefs: [ref('f-b', SEED_TIMESTAMP)] })],
    })

    const { snapshot: merged } = mergeSnapshot(local, remote)

    expect(folderIdsOf(merged, 'wrld_a')).toEqual(['f-a', 'f-b'])
  })

  it('keeps a world the other side has never heard of', () => {
    const local = snapshot(PHONE, { worlds: [world('wrld_a')] })
    const remote = snapshot(DESKTOP, { worlds: [world('wrld_b')] })

    const { snapshot: merged } = mergeSnapshot(local, remote)

    expect(merged.worlds.map((w) => w.worldId).sort()).toEqual([
      'wrld_a',
      'wrld_b',
    ])
  })
})

describe('mergeSnapshot: deletions', () => {
  it('applies a tombstone that is newer than the other side had', () => {
    const local = snapshot(PHONE, {
      worlds: [world('wrld_a', { updatedAt: 100, origin: PHONE })],
    })
    const remote = snapshot(DESKTOP, {
      worlds: [
        world('wrld_a', { updatedAt: 200, deletedAt: 200, origin: DESKTOP }),
      ],
    })

    const { snapshot: merged } = mergeSnapshot(local, remote)

    expect(merged.worlds[0].deletedAt).toBe(200)
  })

  it('lets a later edit revive a row an older tombstone had deleted', () => {
    const local = snapshot(PHONE, {
      worlds: [world('wrld_a', { updatedAt: 300, origin: PHONE })],
    })
    const remote = snapshot(DESKTOP, {
      worlds: [
        world('wrld_a', { updatedAt: 200, deletedAt: 200, origin: DESKTOP }),
      ],
    })

    const { snapshot: merged } = mergeSnapshot(local, remote)

    expect(merged.worlds[0].deletedAt).toBeNull()
  })
})

describe('mergeSnapshot: memos', () => {
  it('keeps the newer text and files the older one away rather than dropping it', () => {
    const local = snapshot(PHONE, {
      memos: [memo('wrld_a', '古いメモ', { updatedAt: 100, origin: PHONE })],
    })
    const remote = snapshot(DESKTOP, {
      memos: [
        memo('wrld_a', '新しいメモ', { updatedAt: 200, origin: DESKTOP }),
      ],
    })

    const { snapshot: merged, memoConflicts } = mergeSnapshot(local, remote)

    expect(merged.memos[0].memo).toBe('新しいメモ')
    expect(merged.memos[0].conflictBackup?.text).toBe('古いメモ')
    expect(memoConflicts).toEqual([
      { worldId: 'wrld_a', keptText: '新しいメモ', backedUpText: '古いメモ' },
    ])
  })

  it('reports no conflict when only one side ever wrote anything', () => {
    const local = snapshot(PHONE, {
      memos: [memo('wrld_a', '', { updatedAt: 100, origin: PHONE })],
    })
    const remote = snapshot(DESKTOP, {
      memos: [memo('wrld_a', 'メモ', { updatedAt: 200, origin: DESKTOP })],
    })

    const { snapshot: merged, memoConflicts } = mergeSnapshot(local, remote)

    expect(merged.memos[0].memo).toBe('メモ')
    expect(memoConflicts).toEqual([])
  })

  it('leaves the text on screen alone when neither side has a timestamp', () => {
    const local = snapshot(PHONE, { memos: [memo('wrld_a', 'ローカルのメモ')] })
    const remote = snapshot(DESKTOP, { memos: [memo('wrld_a', '別のメモ')] })

    const { snapshot: merged, memoConflicts } = mergeSnapshot(local, remote)

    expect(merged.memos[0].memo).toBe('ローカルのメモ')
    expect(merged.memos[0].conflictBackup?.text).toBe('別のメモ')
    expect(memoConflicts).toHaveLength(1)
  })

  it('adopts the other memo when the local one is empty and neither is stamped', () => {
    const local = snapshot(PHONE, { memos: [memo('wrld_a', '')] })
    const remote = snapshot(DESKTOP, {
      memos: [memo('wrld_a', 'バックアップのメモ')],
    })

    const { snapshot: merged, memoConflicts } = mergeSnapshot(local, remote)

    expect(merged.memos[0].memo).toBe('バックアップのメモ')
    expect(memoConflicts).toEqual([])
  })
})

describe('mergeSnapshot: hidden worlds and custom tags', () => {
  it('unhides a world when that is the newer of the two decisions', () => {
    const local = snapshot(PHONE, {
      hiddenWorlds: [
        { worldId: 'wrld_a', updatedAt: 100, deletedAt: null, origin: PHONE },
      ],
    })
    const remote = snapshot(DESKTOP, {
      hiddenWorlds: [
        { worldId: 'wrld_a', updatedAt: 200, deletedAt: 200, origin: DESKTOP },
      ],
    })

    const { snapshot: merged } = mergeSnapshot(local, remote)

    expect(merged.hiddenWorlds[0].deletedAt).toBe(200)
  })

  it('keeps tags added on either device', () => {
    const local = snapshot(PHONE, {
      customTags: [
        {
          worldId: 'wrld_a',
          tagRefs: [{ name: '静か', addedAt: 100, removedAt: null }],
          updatedAt: 100,
          deletedAt: null,
          origin: PHONE,
        },
      ],
    })
    const remote = snapshot(DESKTOP, {
      customTags: [
        {
          worldId: 'wrld_a',
          tagRefs: [{ name: '広い', addedAt: 200, removedAt: null }],
          updatedAt: 200,
          deletedAt: null,
          origin: DESKTOP,
        },
      ],
    })

    const { snapshot: merged } = mergeSnapshot(local, remote)

    expect(
      merged.customTags[0].tagRefs
        .filter(isMember)
        .map((r) => r.name)
        .sort(),
    ).toEqual(['広い', '静か'])
  })
})

describe('mergeFolderOrder', () => {
  it('takes the newer ordering and appends what only the older one knew', () => {
    const merged = mergeFolderOrder(
      { ids: ['a', 'b'], updatedAt: 200, origin: PHONE },
      { ids: ['b', 'a', 'c'], updatedAt: 100, origin: DESKTOP },
      ['a', 'b', 'c'],
    )

    expect(merged.ids).toEqual(['a', 'b', 'c'])
  })

  it('drops ids whose folder no longer exists', () => {
    const merged = mergeFolderOrder(
      { ids: ['a', 'gone', 'b'], updatedAt: 200, origin: PHONE },
      { ids: [], updatedAt: 100, origin: DESKTOP },
      ['a', 'b'],
    )

    expect(merged.ids).toEqual(['a', 'b'])
  })

  it('lists every live folder even if neither ordering mentioned it', () => {
    const merged = mergeFolderOrder(
      { ids: ['a'], updatedAt: 200, origin: PHONE },
      { ids: ['a'], updatedAt: 100, origin: DESKTOP },
      ['a', 'brand-new'],
    )

    expect(merged.ids).toEqual(['a', 'brand-new'])
  })

  it('loses the older ordering, which is the trade this design accepts', () => {
    const merged = mergeFolderOrder(
      { ids: ['c', 'b', 'a'], updatedAt: 200, origin: PHONE },
      { ids: ['b', 'a', 'c'], updatedAt: 100, origin: DESKTOP },
      ['a', 'b', 'c'],
    )

    expect(merged.ids).toEqual(['c', 'b', 'a'])
  })
})

describe('mergeSnapshot: properties that must hold', () => {
  const local = snapshot(PHONE, {
    folders: [
      folder('f-a', '観光', { updatedAt: 10, origin: PHONE }),
      folder('f-b', 'ネタ', { updatedAt: 20, origin: PHONE }),
    ],
    folderOrder: { ids: ['f-a', 'f-b'], updatedAt: 20, origin: PHONE },
    worlds: [
      world('wrld_a', {
        folderRefs: [ref('f-a', 100)],
        updatedAt: 100,
        origin: PHONE,
      }),
      world('wrld_b', { updatedAt: 50, deletedAt: 50, origin: PHONE }),
    ],
    memos: [memo('wrld_a', 'ローカル', { updatedAt: 100, origin: PHONE })],
    settings: { language: { value: 'ja-JP', updatedAt: 100 } },
  })

  const remote = snapshot(DESKTOP, {
    folders: [folder('f-b', 'おもしろ', { updatedAt: 30, origin: DESKTOP })],
    folderOrder: { ids: ['f-b'], updatedAt: 30, origin: DESKTOP },
    worlds: [
      world('wrld_a', {
        folderRefs: [ref('f-b', 200)],
        updatedAt: 200,
        origin: DESKTOP,
      }),
      world('wrld_c', { updatedAt: 300, origin: DESKTOP }),
    ],
    memos: [memo('wrld_a', 'リモート', { updatedAt: 300, origin: DESKTOP })],
    settings: { language: { value: 'en-US', updatedAt: 300 } },
  })

  it('produces the same data whichever device runs it', () => {
    const forward = mergeSnapshot(local, remote).snapshot
    const backward = mergeSnapshot(remote, local).snapshot

    // deviceId is whoever ran the merge; everything else must agree.
    expect(withoutDate({ ...forward, deviceId: '' })).toEqual(
      withoutDate({ ...backward, deviceId: '' }),
    )
  })

  it('changes nothing when merged with itself', () => {
    const once = mergeSnapshot(local, remote).snapshot
    const twice = mergeSnapshot(once, once).snapshot

    expect(withoutDate(twice)).toEqual(withoutDate(once))
  })

  it('reaches the same place whether the third snapshot arrives second or last', () => {
    const third = snapshot('device-third', {
      worlds: [
        world('wrld_a', {
          folderRefs: [ref('f-a', 400, 400)],
          updatedAt: 400,
          origin: 'device-third',
        }),
      ],
    })

    const leftFirst = mergeSnapshot(
      mergeSnapshot(local, remote).snapshot,
      third,
    ).snapshot
    const rightFirst = mergeSnapshot(
      local,
      mergeSnapshot(remote, third).snapshot,
    ).snapshot

    expect(folderIdsOf(leftFirst, 'wrld_a')).toEqual(
      folderIdsOf(rightFirst, 'wrld_a'),
    )
  })

  it('takes the newer value for a setting the user changed on one device', () => {
    const { snapshot: merged } = mergeSnapshot(local, remote)

    expect(merged.settings.language.value).toBe('en-US')
  })
})

describe("a demand that one device's settings replace everyone's", () => {
  it('travels in the merged file rather than being consumed by the merge', () => {
    const local = snapshot(PHONE, {
      settingsOverride: { origin: PHONE, at: 500 },
    })
    const remote = snapshot(DESKTOP, {})

    expect(mergeSnapshot(local, remote).snapshot.settingsOverride).toEqual({
      origin: PHONE,
      at: 500,
    })
  })

  it('picks up one that is already in the file', () => {
    const local = snapshot(PHONE, {})
    const remote = snapshot(DESKTOP, {
      settingsOverride: { origin: DESKTOP, at: 500 },
    })

    expect(mergeSnapshot(local, remote).snapshot.settingsOverride).toEqual({
      origin: DESKTOP,
      at: 500,
    })
  })

  it('keeps the newer of two, so the last person to ask is the one obeyed', () => {
    const local = snapshot(PHONE, {
      settingsOverride: { origin: PHONE, at: 500 },
    })
    const remote = snapshot(DESKTOP, {
      settingsOverride: { origin: DESKTOP, at: 900 },
    })

    expect(mergeSnapshot(local, remote).snapshot.settingsOverride).toEqual({
      origin: DESKTOP,
      at: 900,
    })
  })

  it('settles two made in the same millisecond the same way round either way', () => {
    const local = snapshot(PHONE, {
      settingsOverride: { origin: PHONE, at: 500 },
    })
    const remote = snapshot(DESKTOP, {
      settingsOverride: { origin: DESKTOP, at: 500 },
    })

    expect(mergeSnapshot(local, remote).snapshot.settingsOverride).toEqual(
      mergeSnapshot(remote, local).snapshot.settingsOverride,
    )
  })

  it('leaves worlds and folders entirely alone', () => {
    const local = snapshot(PHONE, {
      settingsOverride: { origin: PHONE, at: 500 },
      folders: [folder('f-a', 'お気に入り', { updatedAt: 10, origin: PHONE })],
      worlds: [world('wrld_a', { updatedAt: 10, origin: PHONE })],
    })
    const remote = snapshot(DESKTOP, {
      folders: [folder('f-b', 'ネタ', { updatedAt: 20, origin: DESKTOP })],
      worlds: [world('wrld_b', { updatedAt: 20, origin: DESKTOP })],
    })

    const merged = mergeSnapshot(local, remote).snapshot
    expect(merged.folders.map((each) => each.id).sort()).toEqual(['f-a', 'f-b'])
    expect(merged.worlds.map((each) => each.worldId).sort()).toEqual([
      'wrld_a',
      'wrld_b',
    ])
    expect(merged.worlds.every((each) => each.deletedAt === null)).toBe(true)
  })
})
