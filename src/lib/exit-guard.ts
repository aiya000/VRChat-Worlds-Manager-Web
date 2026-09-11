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

/** The screen that only decides where the app starts, and replaces itself. */
export const STARTUP_PATH = '/'

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

/** How long to wait for the step back over the guard before giving up on it. */
const STEP_BACK_TIMEOUT_MS = 400

/**
 * Where the guard stands, kept outside React: the screen the app starts at
 * has to hand the guard back before it replaces itself, and that happens in a
 * page, not in the hook.
 */
const guard = {
  inPlace: false,
  /** Whether it was put up while the screen the app starts at was showing. */
  atStartupScreen: false,
  /** Whether the step back below is under way, and its popstate is ours. */
  steppingBack: false,
}

/**
 * Puts the guard in place: a second entry for the page already on screen, so
 * that the next press of back has something of the app's to spend.
 *
 * The router's own state is carried over rather than replaced -- Next reads
 * the entry it lands on, and an entry it does not recognise costs a reload.
 */
export function armExitGuard(atStartupScreen: boolean): void {
  guard.inPlace = true
  guard.atStartupScreen = atStartupScreen
  // A reload of the guard entry lands on one that is already in place.
  if (isGuardEntry(window.history.state)) {
    return
  }
  window.history.pushState(
    { ...window.history.state, [EXIT_GUARD_KEY]: true },
    '',
    window.location.href,
  )
}

/** Whether the guard is standing between the app and the way out right now. */
export function isExitGuardInPlace(): boolean {
  return guard.inPlace
}

/** Called once a press of back has spent the guard, so it is no longer there. */
export function noteExitGuardSpent(): void {
  guard.inPlace = false
  guard.atStartupScreen = false
}

/** Whether the popstate now arriving is the step back this module asked for. */
export function isSteppingBackOverGuard(): boolean {
  return guard.steppingBack
}

/**
 * Hands the guard back before the screen the app starts at replaces itself.
 *
 * That screen only decides where the app begins, and deciding takes a request
 * to VRChat -- a second or three on a phone, all of it spent with back still
 * meaning "close the app". The guard therefore goes up while it is deciding,
 * and comes down here, because what happens next is `replace`: it would write
 * over whichever entry is showing, and the entry showing is the guard's.
 *
 * Stepping back onto the screen the app starts at leaves that entry current
 * again, so the replace lands on it and the app's history holds no trace of a
 * screen there is nothing to go back to. Awaiting the step matters -- until
 * the browser says it has moved, the entry underneath is not the one showing.
 */
export function releaseStartupGuard(): Promise<void> {
  if (!guard.inPlace || !guard.atStartupScreen) {
    return Promise.resolve()
  }

  guard.inPlace = false
  guard.atStartupScreen = false
  guard.steppingBack = true

  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener('popstate', done)
      clearTimeout(givingUp)
      guard.steppingBack = false
      resolve()
    }
    // A step the browser never takes would leave the app on the screen it
    // starts at for good, so this gives up rather than waiting for ever. The
    // guard is then one entry further out than it should be, which costs a
    // press of back and nothing else.
    const givingUp = setTimeout(done, STEP_BACK_TIMEOUT_MS)

    window.addEventListener('popstate', done)
    window.history.back()
  })
}

/** Whether a popped history entry is the guard, rather than what is beyond it. */
export function isGuardEntry(state: unknown): boolean {
  if (state === null || typeof state !== 'object') {
    return false
  }
  return (state as Record<string, unknown>)[EXIT_GUARD_KEY] === true
}
