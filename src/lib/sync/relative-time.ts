/**
 * How long ago something happened, as the pieces a translated string needs.
 *
 * "最終同期: 2026/9/6 10:23:45" answers a question nobody asked. What someone
 * checking on a sync wants to know is whether it happened recently, and a
 * timestamp makes them work that out from a clock. This returns the unit and
 * the count so the wording itself stays in the locale files.
 */

export type RelativeTimeUnit = 'now' | 'minutes' | 'hours' | 'days'

export interface RelativeTime {
  unit: RelativeTimeUnit
  /** How many of `unit`. Always `0` when the unit is `now`. */
  count: number
}

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS
const DAY_MS = 24 * HOUR_MS

/**
 * A clock that is behind the one that wrote `at` -- another device's, or this
 * one after a correction -- would otherwise produce "in 3 minutes", which
 * reads as a bug. A moment in the future is simply "just now".
 */
export function relativeTime(at: number, now: number): RelativeTime {
  const elapsed = Math.max(0, now - at)

  if (elapsed < MINUTE_MS) {
    return { unit: 'now', count: 0 }
  }
  if (elapsed < HOUR_MS) {
    return { unit: 'minutes', count: Math.floor(elapsed / MINUTE_MS) }
  }
  if (elapsed < DAY_MS) {
    return { unit: 'hours', count: Math.floor(elapsed / HOUR_MS) }
  }
  return { unit: 'days', count: Math.floor(elapsed / DAY_MS) }
}

/**
 * How long until the answer above would change, so a screen showing it can
 * redraw exactly then rather than on a fixed timer that is either too eager or
 * too late. Capped so a very old timestamp does not schedule a wake-up days
 * away that the tab will never reach.
 */
export function msUntilRelativeTimeChanges(at: number, now: number): number {
  const elapsed = Math.max(0, now - at)

  if (elapsed < MINUTE_MS) {
    return MINUTE_MS - elapsed
  }
  if (elapsed < HOUR_MS) {
    return MINUTE_MS - (elapsed % MINUTE_MS)
  }
  return Math.min(HOUR_MS - (elapsed % HOUR_MS), HOUR_MS)
}
