'use client'

import { useEffect, useEffectEvent } from 'react'
import { abandonGoogleTrip } from '@/lib/services/abandoned-google-trip'

/**
 * Puts a button that left for Google back, when the browser brought the page
 * back rather than replacing it (#159).
 *
 * `pageshow` with `persisted` is the back/forward cache restoring this very
 * page, which is the one case where the flags a departure left behind are
 * still there to be found; a page that really was replaced returns as a fresh
 * load with nothing to give up.
 *
 * `giveUp` is where the component's own "busy" flags go. The claim shared
 * between the two sync buttons is released here, so each caller only has to
 * know about its own.
 */
export function useAbandonedGoogleTrip(giveUp: () => void): void {
  const giveUpNow = useEffectEvent(() => {
    abandonGoogleTrip()
    giveUp()
  })

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        giveUpNow()
      }
    }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])
}
