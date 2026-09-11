/**
 * Leaving this app by pressing back is one gesture away at all times on
 * Android, and there is no undo for it. What stands in the way is a history
 * entry of the app's own: the first press spends that entry and buys the
 * moment in which to say what the next press will do.
 *
 * Nothing here closes the app, and nothing can -- a page may not close a
 * window it did not open. The second press closes it because by then there is
 * no history left to go back to, which is the browser's own way out.
 *
 * **The entry is only ever added from a user gesture.** Chrome's back button
 * and back gesture skip every entry a page added without one: a `pushState`
 * from a document that has had no user activation marks that document's
 * entries as skippable, and the gesture then goes straight past them and out
 * of the app (Chromium's history manipulation intervention). A press of back
 * ends the activation for this purpose, so the next `pushState` needs a fresh
 * tap -- and a tap is also what clears the mark. The guard therefore goes up
 * at a tap, comes down when back spends it, and goes up again at the next
 * tap. Nothing puts it up from an effect or a timer: an entry added that way
 * is one the gesture would not stop at, which is how the app came to close at
 * the first press (#188).
 */

import { isRunningInstalled } from '@/lib/pwa'

/** What marks the entry that stands between the app and the way out. */
export const EXIT_GUARD_KEY = '__exitGuard'

/**
 * What marks the entry below the guard: the one the app was opened at, and
 * the one a press of back lands on when it spends the guard. Marked so that
 * landing here can be told from landing on a screen deeper in the app, which
 * is also a pop of an entry that is not the guard's.
 */
export const EXIT_STOP_KEY = '__exitStop'

/** The screen that only decides where the app starts, and replaces itself. */
export const STARTUP_PATH = '/'

/** How long the warning is shown. */
export const EXIT_GUARD_WARNING_MS = 2000

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
 * An **installed app always qualifies.** Back leaves it whatever the history
 * says, and the history says different things on different devices: a PWA
 * does not reliably launch with one entry behind it. A PWA owns its window,
 * so the guard's own machinery -- one entry at a time, and a pop of that
 * entry telling a genuine back from a step deeper in -- is what keeps it from
 * firing mid-navigation, not this check.
 *
 * A plain browser tab is the other case, and there the history can be trusted:
 * guard only when **the device has a back gesture** (a desktop tab does
 * nothing on back, so there is nothing to warn about) and **there is nothing
 * behind the app** (or back means "the page I was on before", which is not
 * leaving and must not be dressed up as it).
 *
 * Asked once, at the first screen the app draws -- see `shouldGuardExit()`.
 */
export function wantsExitGuard({
  historyLength,
  onGuardEntry,
  installed,
  touch,
}: ExitGuardSurroundings): boolean {
  if (installed) {
    return true
  }
  if (!touch) {
    return false
  }
  return historyLength === 1 || onGuardEntry
}

/** Where the guard stands, kept outside React so it survives every screen. */
const guard = {
  /** Whether the guard entry is somewhere at or above the entry on screen. */
  inPlace: false,
  /** The answer to `wantsExitGuard()`, which is asked once. */
  wanted: null as boolean | null,
}

/**
 * Whether this app is one the back gesture would leave, answered once for as
 * long as the page is loaded.
 *
 * **Asking again later would get a different answer, and a wrong one.** The
 * guard is a history entry, so an app that has put one up has two entries
 * where it had one, and "there is nothing behind this app" then reads as
 * false -- the app would be measuring what it added itself.
 *
 * Whether there was anything behind the app is a fact about how it was
 * opened. It cannot change while it is open, so it is settled where it is
 * true: at the first screen drawn, before anything has been pushed.
 */
export function shouldGuardExit(): boolean {
  if (guard.wanted === null) {
    guard.wanted = wantsExitGuard({
      historyLength: window.history.length,
      onGuardEntry: isGuardEntry(window.history.state),
      installed: isRunningInstalled(),
      touch: navigator.maxTouchPoints > 0,
    })
  }
  return guard.wanted
}

/**
 * Puts the guard in place: marks the entry on screen as the one to stop at,
 * and pushes a second entry for the same screen above it, so that the next
 * press of back has something of the app's to spend.
 *
 * **Call this from a user gesture and from nowhere else** -- see the note at
 * the top of this file. A reload of the guard entry lands on one that is
 * already in place, and nothing is pushed then.
 *
 * The router's own state is carried over rather than replaced -- Next reads
 * the entry it lands on, and an entry it does not recognise costs a reload.
 */
export function armExitGuard(): void {
  guard.inPlace = true
  const state: unknown = window.history.state
  if (isGuardEntry(state)) {
    return
  }
  const here = window.location.href
  window.history.replaceState(markedAs(state, EXIT_STOP_KEY), '', here)
  window.history.pushState(markedAs(state, EXIT_GUARD_KEY), '', here)
}

/** The entry's state with one of the app's marks on it, and no other. */
function markedAs(state: unknown, key: string): Record<string, unknown> {
  const marked: Record<string, unknown> = {}
  if (state !== null && typeof state === 'object') {
    for (const [name, value] of Object.entries(state)) {
      if (name !== EXIT_GUARD_KEY && name !== EXIT_STOP_KEY) {
        marked[name] = value
      }
    }
  }
  marked[key] = true
  return marked
}

/** Whether the guard is standing between the app and the way out right now. */
export function isExitGuardInPlace(): boolean {
  return guard.inPlace
}

/** Called once a press of back has spent the guard, so it is no longer there. */
export function noteExitGuardSpent(): void {
  guard.inPlace = false
}

/**
 * Called when the guard entry is shown again without being pushed: a press
 * of back from deeper in the app, or of forward after the guard was spent.
 */
export function noteExitGuardReached(): void {
  guard.inPlace = true
}

/** Whether a history entry's state is the guard's. */
export function isGuardEntry(state: unknown): boolean {
  return hasMark(state, EXIT_GUARD_KEY)
}

/** Whether a history entry's state is the entry below the guard. */
export function isStopEntry(state: unknown): boolean {
  return hasMark(state, EXIT_STOP_KEY)
}

function hasMark(state: unknown, key: string): boolean {
  if (state === null || typeof state !== 'object') {
    return false
  }
  return (state as Record<string, unknown>)[key] === true
}
