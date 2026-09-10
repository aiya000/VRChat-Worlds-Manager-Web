import { describe, expect, it } from 'vitest'
import {
  notifyBackendLimitReached,
  readBackendLimitKind,
  subscribeToBackendLimitReached,
  type BackendLimitKind,
} from '@/lib/services/backend-limit'

/**
 * The Worker has answered `429` with a reason for a long time and nothing
 * read it, so every limit reached the screen as the same generic error and
 * "wait a minute" could not be told from "the app is done for today" (#170).
 */
describe('reading which of the backend limits was reached', () => {
  it('recognises each reason the Worker sends', () => {
    const kinds: BackendLimitKind[] = [
      'rate-limit-exceeded',
      'sign-in-limit-exceeded',
      'daily-quota-exceeded',
    ]

    for (const kind of kinds) {
      expect(readBackendLimitKind(JSON.stringify({ error: kind }))).toBe(kind)
    }
  })

  it('does not claim a limit for a 429 that came from VRChat itself', () => {
    // VRChat rate limits too, and its body is not this shape. Saying "this
    // app has reached its limit" about VRChat's own refusal would be wrong.
    expect(readBackendLimitKind('{"error":{"message":"Too fast"}}')).toBeNull()
    expect(readBackendLimitKind('Too Many Requests')).toBeNull()
    expect(readBackendLimitKind('')).toBeNull()
  })

  it('does not treat an unknown reason as one it knows', () => {
    expect(readBackendLimitKind('{"error":"something-else"}')).toBeNull()
    expect(readBackendLimitKind('{"error":42}')).toBeNull()
    expect(readBackendLimitKind('null')).toBeNull()
  })
})

describe('announcing that a limit was reached', () => {
  it('reaches every listener, with which limit it was', () => {
    const seen: BackendLimitKind[] = []
    const unsubscribe = subscribeToBackendLimitReached((kind) =>
      seen.push(kind),
    )

    notifyBackendLimitReached('daily-quota-exceeded')
    notifyBackendLimitReached('rate-limit-exceeded')

    expect(seen).toEqual(['daily-quota-exceeded', 'rate-limit-exceeded'])
    unsubscribe()
  })

  it('stops reaching a listener that unsubscribed', () => {
    const seen: BackendLimitKind[] = []
    const unsubscribe = subscribeToBackendLimitReached((kind) =>
      seen.push(kind),
    )
    unsubscribe()

    notifyBackendLimitReached('rate-limit-exceeded')

    expect(seen).toEqual([])
  })
})
