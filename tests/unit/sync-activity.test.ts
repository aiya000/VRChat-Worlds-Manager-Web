import { beforeEach, describe, expect, it } from 'vitest'

import {
  abortSync,
  canAbortSync,
  endSync,
  reportSyncStep,
  SyncAbortedError,
  syncActivity,
  tryBeginSync,
  withoutSyncing,
} from '@/lib/services/sync-activity'

function begin(): AbortSignal {
  const claim = tryBeginSync()
  if (claim.kind !== 'started') {
    throw new Error(`expected a sync to start, got ${JSON.stringify(claim)}`)
  }
  return claim.signal
}

describe('stopping a sync (#221)', () => {
  beforeEach(() => {
    // Module state, shared by every test in this file.
    endSync(null)
  })

  it('aborts its signal with a reason that says it was on purpose', () => {
    const signal = begin()
    reportSyncStep('uploading')

    abortSync()

    expect(signal.aborted).toBe(true)
    expect(signal.reason).toBeInstanceOf(SyncAbortedError)
    expect(syncActivity().aborting).toBe(true)
  })

  it('cannot be done once this device is being written', () => {
    const signal = begin()
    reportSyncStep('applying')

    expect(canAbortSync()).toBe(false)
    abortSync()

    expect(signal.aborted).toBe(false)
    expect(syncActivity().aborting).toBe(false)
  })

  it('does nothing when no sync is running', () => {
    expect(canAbortSync()).toBe(false)
    abortSync()
    expect(syncActivity().running).toBe(false)
  })

  it('leaves the next sync with a signal of its own', () => {
    begin()
    abortSync()
    endSync(null)

    expect(begin().aborted).toBe(false)
  })

  it('forgets the step when the sync ends', () => {
    begin()
    reportSyncStep('merging')
    endSync(1_700_000_000_000)

    expect(syncActivity()).toEqual({
      running: false,
      lastSyncedAt: 1_700_000_000_000,
      step: null,
      aborting: false,
    })
  })
})

describe('a sync asked for while favourites are being fetched', () => {
  beforeEach(() => {
    endSync(null)
  })

  it('is refused until the fetch is over', async () => {
    let finish = () => {}
    const fetching = withoutSyncing(
      () => new Promise<void>((resolve) => (finish = resolve)),
    )

    expect(tryBeginSync()).toEqual({ kind: 'refused', because: 'fetching' })

    finish()
    await fetching

    expect(tryBeginSync().kind).toBe('started')
  })

  it('is refused even when the fetch fails, until it has failed', async () => {
    let fail = () => {}
    const fetching = withoutSyncing(
      () =>
        new Promise<void>((_, reject) => (fail = () => reject(new Error('x')))),
    )

    expect(tryBeginSync().kind).toBe('refused')

    fail()
    await expect(fetching).rejects.toThrow('x')

    expect(tryBeginSync().kind).toBe('started')
  })
})
