'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { useLocalization } from '@/hooks/use-localization'
import {
  armExitGuard,
  EXIT_GUARD_WINDOW_MS,
  isExitGuardInPlace,
  isGuardEntry,
  isSteppingBackOverGuard,
  noteExitGuardSpent,
  STARTUP_PATH,
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
 *
 * The screen the app starts at is guarded as well, and needs it most: it
 * decides where the app begins over a request to VRChat, seconds in which
 * back would otherwise close the app without a word. That screen hands the
 * guard back through `releaseStartupGuard()` before it replaces itself.
 */
export function useExitGuard(): void {
  const { t } = useLocalization()
  const pathname = usePathname()

  // `t` is a new function on every render, and this listens for the life of
  // the page, so it is kept current from an effect rather than depended on.
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  })

  // Runs again on every screen: the guard is handed back when the app leaves
  // the screen it starts at, and has to be put up again where it lands.
  useEffect(() => {
    if (isExitGuardInPlace()) {
      return
    }
    const wanted = wantsExitGuard({
      historyLength: window.history.length,
      onGuardEntry: isGuardEntry(window.history.state),
      installed: isRunningInstalled(),
      touch: navigator.maxTouchPoints > 0,
    })
    if (wanted) {
      armExitGuard(pathname === STARTUP_PATH)
    }
  }, [pathname])

  useEffect(() => {
    let rearming: ReturnType<typeof setTimeout> | null = null

    const handlePopState = (event: PopStateEvent) => {
      // Landing on the guard is the app's own entry being shown again, not an
      // attempt to leave: the press came from somewhere deeper in the app.
      if (
        isSteppingBackOverGuard() ||
        !isExitGuardInPlace() ||
        isGuardEntry(event.state) ||
        rearming !== null
      ) {
        return
      }

      noteExitGuardSpent()
      toast(tRef.current('exit-guard:press-back-again'), {
        duration: EXIT_GUARD_WINDOW_MS,
      })
      rearming = setTimeout(() => {
        rearming = null
        armExitGuard(window.location.pathname === STARTUP_PATH)
      }, EXIT_GUARD_WINDOW_MS)
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
