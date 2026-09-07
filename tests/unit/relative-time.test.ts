import { describe, expect, it } from 'vitest'
import {
  msUntilRelativeTimeChanges,
  relativeTime,
} from '@/lib/sync/relative-time'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

const NOW = 1_800_000_000_000

describe('relativeTime', () => {
  it('calls anything under a minute "just now"', () => {
    expect(relativeTime(NOW, NOW)).toEqual({ unit: 'now', count: 0 })
    expect(relativeTime(NOW - 59_999, NOW)).toEqual({ unit: 'now', count: 0 })
  })

  it('counts whole minutes, then whole hours, then whole days', () => {
    expect(relativeTime(NOW - MINUTE, NOW)).toEqual({
      unit: 'minutes',
      count: 1,
    })
    expect(relativeTime(NOW - 59 * MINUTE, NOW)).toEqual({
      unit: 'minutes',
      count: 59,
    })
    expect(relativeTime(NOW - HOUR, NOW)).toEqual({ unit: 'hours', count: 1 })
    expect(relativeTime(NOW - 23 * HOUR, NOW)).toEqual({
      unit: 'hours',
      count: 23,
    })
    expect(relativeTime(NOW - DAY, NOW)).toEqual({ unit: 'days', count: 1 })
    expect(relativeTime(NOW - 400 * DAY, NOW)).toEqual({
      unit: 'days',
      count: 400,
    })
  })

  it('rounds down rather than up, so nothing is claimed early', () => {
    expect(relativeTime(NOW - (2 * MINUTE + 59_000), NOW)).toEqual({
      unit: 'minutes',
      count: 2,
    })
  })

  // Two devices' clocks are never exactly the same, and "in 3 minutes" next
  // to "last synced" reads as a bug rather than as a clock difference.
  it('never says a sync happened in the future', () => {
    expect(relativeTime(NOW + 10 * MINUTE, NOW)).toEqual({
      unit: 'now',
      count: 0,
    })
  })
})

describe('msUntilRelativeTimeChanges', () => {
  it('waits out the rest of the first minute', () => {
    expect(msUntilRelativeTimeChanges(NOW - 20_000, NOW)).toBe(40_000)
  })

  it('lands on the next whole minute while counting minutes', () => {
    expect(msUntilRelativeTimeChanges(NOW - (5 * MINUTE + 10_000), NOW)).toBe(
      50_000,
    )
  })

  it('lands on the next whole hour once past one hour', () => {
    expect(
      msUntilRelativeTimeChanges(NOW - (3 * HOUR + 20 * MINUTE), NOW),
    ).toBe(40 * MINUTE)
  })

  // A tab left open for a week must not schedule a timer days out that it will
  // never reach, and an hour is short enough to be harmless.
  it('never waits longer than an hour', () => {
    expect(msUntilRelativeTimeChanges(NOW - 30 * DAY, NOW)).toBeLessThanOrEqual(
      HOUR,
    )
  })

  it('always waits some positive time', () => {
    for (const elapsed of [0, 1, MINUTE, HOUR, DAY, 9 * DAY]) {
      expect(msUntilRelativeTimeChanges(NOW - elapsed, NOW)).toBeGreaterThan(0)
    }
  })
})
