import { DurableObject } from 'cloudflare:workers'

/**
 * What counting one use against a bucket came to.
 *
 * `count` is the number of uses the bucket holds afterwards -- the one just
 * counted included when it was let through, unchanged when it was refused.
 */
export interface CountResult {
  allowed: boolean
  count: number
}

/** The part of Durable Object storage the counter uses. */
export interface CounterStorage {
  get<T>(key: string): Promise<T | undefined>
  put<T>(key: string, value: T): Promise<void>
}

/**
 * Counts one use against `bucket`, unless it already holds `limit`.
 *
 * A refused use is not counted, so a caller who keeps knocking after the
 * limit costs a read each time and never a write.
 *
 * The read and the write here cannot be split by another request: a Durable
 * Object runs one event at a time and holds new events at its input gate
 * while storage is being awaited. That is what KV could never give (#171) --
 * requests that arrived together all read the same number there.
 */
export async function countUse(
  storage: CounterStorage,
  bucket: string,
  limit: number,
): Promise<CountResult> {
  const current = (await storage.get<number>(bucket)) ?? 0
  if (current >= limit) {
    return { allowed: false, count: current }
  }
  const next = current + 1
  await storage.put(bucket, next)
  return { allowed: true, count: next }
}

/** The next midnight UTC after `now`, when every daily bucket is spent. */
export function nextUtcMidnight(now: Date): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)
}

/**
 * One of these per IP address, and one more for the Worker as a whole.
 *
 * Its buckets are named by the period they count (`day:2026-09-24`,
 * `login:2026-09-24T02`), so a new period simply starts a new key. Everything
 * is deleted at the next midnight UTC by an alarm: the privacy policy promises
 * that what is kept about an address is gone within the day, and nothing
 * outlives the day's own bucket anyway.
 *
 * SQLite-backed, which is what the free plan offers, and whose allowance of
 * written rows (100,000 a day) is a hundred times KV's 1,000 writes.
 */
export class UsageCounter extends DurableObject {
  async count(bucket: string, limit: number): Promise<CountResult> {
    const result = await countUse(this.ctx.storage, bucket, limit)
    if ((await this.ctx.storage.getAlarm()) === null) {
      await this.ctx.storage.setAlarm(nextUtcMidnight(new Date()))
    }
    return result
  }

  async alarm(): Promise<void> {
    await this.ctx.storage.deleteAll()
  }
}
