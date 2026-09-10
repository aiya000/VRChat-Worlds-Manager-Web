'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useLocalization } from '@/hooks/use-localization'
import {
  EXIT_GUARD_KEY,
  EXIT_GUARD_WINDOW_MS,
  isGuardEntry,
  wantsExitGuard,
} from '@/lib/exit-guard'
import { isRunningInstalled } from '@/lib/pwa'

/**
 * Asks for the back gesture twice before the app is left, the way an Android
 * app does: the first press says what the next one will do, and only a press
 * that comes within the couple of seconds after it goes through.
 *
 * The app keeps one history entry of its own on top of the one it was opened
 * at. Back spends that entry rather than the app, and this is what notices --
 * a press deeper in the app pops an entry of the router's instead and is left
 * alone. Once the warning has been shown the guard is gone, so a second press
 * finds no history at all and the browser closes the app itself; if the couple
 * of seconds pass without one, the guard is put back and the next press starts
 * over.
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
    const surroundings = {
      historyLength: window.history.length,
      onGuardEntry: isGuardEntry(window.history.state),
      installed: isRunningInstalled(),
      touch: navigator.maxTouchPoints > 0,
    }
    if (!wantsExitGuard(surroundings)) {
      return
    }

    let rearming: ReturnType<typeof setTimeout> | null = null

    const arm = () => {
      window.history.pushState(
        { ...window.history.state, [EXIT_GUARD_KEY]: true },
        '',
        window.location.href,
      )
    }

    const handlePopState = (event: PopStateEvent) => {
      // Landing on the guard is the app's own entry being shown again, not an
      // attempt to leave: the press came from somewhere deeper in the app.
      if (isGuardEntry(event.state) || rearming !== null) {
        return
      }

      toast(tRef.current('exit-guard:press-back-again'), {
        duration: EXIT_GUARD_WINDOW_MS,
      })
      rearming = setTimeout(() => {
        rearming = null
        arm()
      }, EXIT_GUARD_WINDOW_MS)
    }

    if (!surroundings.onGuardEntry) {
      arm()
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
      if (rearming !== null) {
        clearTimeout(rearming)
      }
    }
  }, [])
}
