import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DRIVE_REQUEST_TIMEOUT_MS,
  DriveTimeoutError,
  readFile,
  updateFile,
} from '@/lib/services/google-drive'
import { SyncAbortedError } from '@/lib/services/sync-activity'

/** A Drive that takes the request and never answers, as in #220. */
function stubSilentDrive() {
  const fetch = vi.fn(
    (_url: string, init: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init.signal?.addEventListener('abort', () =>
          reject(init.signal?.reason ?? new DOMException('aborted')),
        )
      }),
  )
  vi.stubGlobal('fetch', fetch)
  return fetch
}

describe('a Drive request that is never answered (#220)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('gives up after the time limit', async () => {
    stubSilentDrive()

    const upload = updateFile('token', 'file-1', '{}')
    const outcome = expect(upload).rejects.toBeInstanceOf(DriveTimeoutError)
    await vi.advanceTimersByTimeAsync(DRIVE_REQUEST_TIMEOUT_MS)

    await outcome
  })

  it('is still waiting just before the time limit', async () => {
    stubSilentDrive()

    let settled = false
    readFile('token', 'file-1').then(
      () => (settled = true),
      () => (settled = true),
    )
    await vi.advanceTimersByTimeAsync(DRIVE_REQUEST_TIMEOUT_MS - 1)

    expect(settled).toBe(false)
  })

  it('stops as soon as the sync is stopped, and says so', async () => {
    stubSilentDrive()
    const controller = new AbortController()

    const upload = updateFile('token', 'file-1', '{}', controller.signal)
    controller.abort(new SyncAbortedError('stopped'))

    await expect(upload).rejects.toBeInstanceOf(SyncAbortedError)
  })

  it('is not sent at all when the sync was already stopped', async () => {
    const fetch = stubSilentDrive()
    const controller = new AbortController()
    controller.abort(new SyncAbortedError('stopped'))

    await expect(
      readFile('token', 'file-1', controller.signal),
    ).rejects.toBeInstanceOf(SyncAbortedError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('leaves no timer behind once answered', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"id":"file-1","version":"2"}')),
    )

    await updateFile('token', 'file-1', '{}')

    expect(vi.getTimerCount()).toBe(0)
  })
})
