/**
 * The stages of reading another account's favorites, in the order they happen.
 *
 * Named rather than counted so the dialog can say what is going on, the way
 * the Google Drive sync screen does: a fetch that has stopped and a fetch that
 * is merely slow look identical behind a bare spinner.
 */
export const FETCH_STEPS = ['reading-account', 'fetching-favorites'] as const

export type FetchStep = (typeof FETCH_STEPS)[number]

/** How far through `FETCH_STEPS` a step is, as a whole percentage. */
export function fetchStepPercentage(step: FetchStep): number {
  return Math.round(
    ((FETCH_STEPS.indexOf(step) + 1) / FETCH_STEPS.length) * 100,
  )
}

/**
 * How far the import itself has got. Nothing to import is finished rather than
 * stuck at zero.
 */
export function importProgressPercentage(done: number, total: number): number {
  if (total === 0) {
    return 100
  }
  return Math.round((done / total) * 100)
}
