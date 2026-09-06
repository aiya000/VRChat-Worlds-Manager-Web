import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDebouncer, isStale } from '@/lib/sync/auto-sync-policy'

describe('createDebouncer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('waits for the changes to stop before sending anything', () => {
    const flush = vi.fn()
    const debouncer = createDebouncer({ idleMs: 10, maxWaitMs: 100, flush })

    debouncer.note()
    vi.advanceTimersByTime(9)
    expect(flush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('sends a burst of changes once, not once each', () => {
    const flush = vi.fn()
    const debouncer = createDebouncer({ idleMs: 10, maxWaitMs: 100, flush })

    for (let i = 0; i < 5; i++) {
      debouncer.note()
      vi.advanceTimersByTime(5)
    }
    expect(flush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(10)
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('gives up waiting once the ceiling is reached', () => {
    const flush = vi.fn()
    const debouncer = createDebouncer({ idleMs: 10, maxWaitMs: 100, flush })

    // Changes that never stop: without the ceiling, this postpones the upload
    // for as long as someone keeps dragging things around.
    for (let i = 0; i < 19; i++) {
      debouncer.note()
      vi.advanceTimersByTime(5)
      expect(flush).not.toHaveBeenCalled()
    }

    debouncer.note()
    vi.advanceTimersByTime(5)
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('measures the ceiling from the first change of the next run', () => {
    const flush = vi.fn()
    const debouncer = createDebouncer({ idleMs: 10, maxWaitMs: 100, flush })

    debouncer.note()
    vi.advanceTimersByTime(10)
    expect(flush).toHaveBeenCalledTimes(1)

    debouncer.note()
    vi.advanceTimersByTime(10)
    expect(flush).toHaveBeenCalledTimes(2)
  })

  it('sends what is waiting when asked to, and nothing when nothing is', () => {
    const flush = vi.fn()
    const debouncer = createDebouncer({ idleMs: 10, maxWaitMs: 100, flush })

    debouncer.flush()
    expect(flush).not.toHaveBeenCalled()

    debouncer.note()
    debouncer.flush()
    expect(flush).toHaveBeenCalledTimes(1)

    // And having been sent, it is not sent again when the timer would have run.
    vi.advanceTimersByTime(200)
    expect(flush).toHaveBeenCalledTimes(1)
  })

  it('sends nothing at all once cancelled', () => {
    const flush = vi.fn()
    const debouncer = createDebouncer({ idleMs: 10, maxWaitMs: 100, flush })

    debouncer.note()
    expect(debouncer.pending()).toBe(true)

    debouncer.cancel()
    vi.advanceTimersByTime(200)

    expect(flush).not.toHaveBeenCalled()
    expect(debouncer.pending()).toBe(false)
  })
})

describe('isStale', () => {
  it('treats never having synced as stale', () => {
    expect(isStale(null, 1_000, 100)).toBe(true)
  })

  it('is not stale until the whole interval has passed', () => {
    expect(isStale(1_000, 1_099, 100)).toBe(false)
    expect(isStale(1_000, 1_100, 100)).toBe(true)
  })
})
