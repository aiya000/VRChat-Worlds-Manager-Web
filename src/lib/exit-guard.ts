/**
 * Leaving this app by pressing back is one gesture away at all times on
 * Android, and there is no undo for it. What stands in the way is a history
 * entry of the app's own: the first press spends that entry and buys the
 * moment in which to say what the next press will do.
 *
 * Nothing here closes the app, and nothing can -- a page may not close a
 * window it did not open. The second press closes it because by then there is
 * no history left to go back to, which is the browser's own way out.
 */

/** What marks the history entry that stands between the app and the way out. */
export const EXIT_GUARD_KEY = '__exitGuard'

/** How long the warning stands before the guard is put back. */
export const EXIT_GUARD_WINDOW_MS = 2000

export interface ExitGuardSurroundings {
  /** `history.length`: 1 means this app is all there is behind the button. */
  historyLength: number
  /** Whether the entry being shown is already the guard -- after a reload. */
  onGuardEntry: boolean
  /** Whether the app was opened from the home screen rather than a tab. */
  installed: boolean
  /** Whether the device is one that has a back gesture at all. */
  touch: boolean
}

/**
 * Whether to stand in the way of the back gesture at all.
 *
 * Two things have to be true. **The device has to have a back gesture**, or
 * the warning is about something that will never happen: a desktop browser
 * showing the first page of a tab does nothing at all when back is pressed.
 * And **there has to be nothing behind this app in the history**, or back
 * means "the page I was on before", which is not leaving and must not be
 * described as leaving.
 */
export function wantsExitGuard({
  historyLength,
  onGuardEntry,
  installed,
  touch,
}: ExitGuardSurroundings): boolean {
  if (!installed && !touch) {
    return false
  }
  return historyLength === 1 || onGuardEntry
}

/**
 * Puts the guard in place: a second entry for the page already on screen, so
 * that the next press of back has something of the app's to spend.
 *
 * The router's own state is carried over rather than replaced -- Next reads
 * the entry it lands on, and an entry it does not recognise costs a reload.
 */
export function armExitGuard(): void {
  window.history.pushState(
    { ...window.history.state, [EXIT_GUARD_KEY]: true },
    '',
    window.location.href,
  )
}

/** Whether a popped history entry is the guard, rather than what is beyond it. */
export function isGuardEntry(state: unknown): boolean {
  if (state === null || typeof state !== 'object') {
    return false
  }
  return (state as Record<string, unknown>)[EXIT_GUARD_KEY] === true
}
