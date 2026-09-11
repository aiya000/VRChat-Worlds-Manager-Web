'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useLocalization } from '@/hooks/use-localization'
import {
  armExitGuard,
  EXIT_GUARD_WARNING_MS,
  isExitGuardInPlace,
  isGuardEntry,
  isStopEntry,
  noteExitGuardReached,
  noteExitGuardSpent,
  shouldGuardExit,
  STARTUP_PATH,
} from '@/lib/exit-guard'

/**
 * Asks for the back gesture twice before the app is left, the way an Android
 * app does: the first press says what the next one will do.
 *
 * The app keeps one history entry of its own above the one it was opened at.
 * Back spends that entry rather than the app, and landing on the entry below
 * is what this notices; a press deeper in the app lands somewhere else and is
 * left alone. Once the warning has been shown the entry is gone, so the next
 * press finds no history at all and the browser closes the app itself.
 *
 * The entry goes up at a tap and never on its own. Chrome skips an entry
 * added without a gesture, and one added after a press of back until the next
 * gesture, so the warning is followed by a way out for as long as the user
 * does not touch the app again -- a tap after it puts the guard back (#188).
 * The screen the app starts at is left alone: it replaces itself, and the tap
 * that counts is one on wherever it lands.
 */
export function useExitGuard(): void {
  const { t } = useLocalization()

  // `t` is a new function on every render, and this listens for the life of
  // the page, so it is kept current from an effect rather than depended on.
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  })

  useEffect(() => {
    // Decided here, before anything has been pushed, so that the history it
    // reads is the one the app was opened with. A reload of the guard entry
    // lands with the guard already in place, and nothing to push.
    if (shouldGuardExit() && isGuardEntry(window.history.state)) {
      noteExitGuardReached()
    }

    const arm = (event: Event) => {
      // Only a gesture of the user's grants the activation the entry needs;
      // a `click()` from a script does not, and nor does Escape, which is
      // the one key Chrome leaves out.
      if (!event.isTrusted) {
        return
      }
      if (event instanceof KeyboardEvent && event.key === 'Escape') {
        return
      }
      if (window.location.pathname === STARTUP_PATH) {
        return
      }
      if (!isExitGuardInPlace() && shouldGuardExit()) {
        armExitGuard()
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      // Back from deeper in, or forward after the warning: the guard entry is
      // on screen again, and stands.
      if (isGuardEntry(event.state)) {
        noteExitGuardReached()
        return
      }
      if (!isStopEntry(event.state) || !isExitGuardInPlace()) {
        return
      }
      noteExitGuardSpent()
      toast(tRef.current('exit-guard:press-back-again'), {
        duration: EXIT_GUARD_WARNING_MS,
      })
    }

    // Capturing, so the guard is pushed before a tap on a link has the router
    // push the screen it leads to: the guard has to sit below that screen.
    window.addEventListener('click', arm, true)
    window.addEventListener('keydown', arm, true)
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('click', arm, true)
      window.removeEventListener('keydown', arm, true)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])
}
