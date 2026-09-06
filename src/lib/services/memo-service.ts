import { Context, Effect, Layer } from 'effect'
import { db, isActive } from './db'
import { touched } from './sync-meta'

/**
 * A memo that two devices wrote differently, after the merge picked one.
 *
 * Nothing is lost when this happens -- the text that did not win is kept on
 * the row -- but until someone is shown both, "kept" and "lost" are the same
 * thing from where they are sitting.
 */
export interface MemoConflictEntry {
  worldId: string
  /** The world's name, so the list reads as worlds rather than as ids. */
  worldName: string
  /** What the memo says now. */
  currentText: string
  /** What the other device had written. */
  backedUpText: string
  /** When the text that lost was written. */
  at: number
}

export class MemoService extends Context.Tag('MemoService')<
  MemoService,
  {
    readonly getMemo: (worldId: string) => Effect.Effect<string, Error>
    readonly setMemoAndSave: (
      worldId: string,
      memo: string,
    ) => Effect.Effect<void, Error>
    readonly searchMemoText: (
      searchText: string,
    ) => Effect.Effect<string[], Error>
    readonly listMemoConflicts: () => Effect.Effect<MemoConflictEntry[], Error>
    /** Drops the set-aside text. The memo on screen is the one to keep. */
    readonly discardMemoBackup: (worldId: string) => Effect.Effect<void, Error>
    /**
     * Puts the set-aside text back as the memo, keeping what it replaces in
     * its place -- so pressing this twice returns to where it started rather
     * than destroying the other version.
     */
    readonly restoreMemoBackup: (worldId: string) => Effect.Effect<void, Error>
  }
>() {}

export const MemoServiceLive = Layer.succeed(MemoService, {
  getMemo: (worldId) =>
    Effect.tryPromise({
      try: async () => {
        const record = await db.memos.get(worldId)
        if (record === undefined || !isActive(record)) {
          return ''
        }
        return record.memo
      },
      catch: (e) => new Error(`Failed to get memo: ${e}`),
    }),

  setMemoAndSave: (worldId, memo) =>
    Effect.tryPromise({
      try: async () => {
        const existing = await db.memos.get(worldId)
        await db.memos.put({
          worldId,
          memo,
          // Whatever the user just typed wins over anything a merge had set
          // aside, so the note they are looking at is the one that is kept.
          conflictBackup: existing?.conflictBackup ?? null,
          ...(await touched()),
        })
      },
      catch: (e) => new Error(`Failed to save memo: ${e}`),
    }),

  listMemoConflicts: () =>
    Effect.tryPromise({
      try: async () => {
        const rows = await db.memos
          .filter((m) => isActive(m) && m.conflictBackup !== null)
          .toArray()

        return Promise.all(
          rows.map(async (row) => {
            const world = await db.worlds.get(row.worldId)
            return {
              worldId: row.worldId,
              worldName: world?.name ?? row.worldId,
              currentText: row.memo,
              backedUpText: row.conflictBackup!.text,
              at: row.conflictBackup!.at,
            }
          }),
        )
      },
      catch: (e) => new Error(`Failed to list the memo conflicts: ${e}`),
    }),

  discardMemoBackup: (worldId) =>
    Effect.tryPromise({
      try: async () => {
        const existing = await db.memos.get(worldId)
        if (existing === undefined) {
          return
        }
        await db.memos.put({
          ...existing,
          conflictBackup: null,
          ...(await touched()),
        })
      },
      catch: (e) => new Error(`Failed to discard the memo backup: ${e}`),
    }),

  restoreMemoBackup: (worldId) =>
    Effect.tryPromise({
      try: async () => {
        const existing = await db.memos.get(worldId)
        if (existing === undefined || existing.conflictBackup === null) {
          return
        }
        const restored = existing.conflictBackup.text
        await db.memos.put({
          ...existing,
          memo: restored,
          // The two swap places rather than one replacing the other: a press
          // made by mistake is undone by pressing again.
          conflictBackup: { text: existing.memo, at: existing.updatedAt },
          ...(await touched()),
        })
      },
      catch: (e) => new Error(`Failed to restore the memo backup: ${e}`),
    }),

  searchMemoText: (searchText) =>
    Effect.tryPromise({
      try: async () => {
        const lower = searchText.toLowerCase()
        const matching = await db.memos
          .filter((m) => isActive(m) && m.memo.toLowerCase().includes(lower))
          .toArray()
        return matching.map((m) => m.worldId)
      },
      catch: (e) => new Error(`Failed to search memos: ${e}`),
    }),
})
