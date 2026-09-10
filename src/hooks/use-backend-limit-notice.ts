'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { useLocalization } from '@/hooks/use-localization'
import {
  subscribeToBackendLimitReached,
  type BackendLimitKind,
} from '@/lib/services/backend-limit'

const descriptionKeys: Record<BackendLimitKind, string> = {
  'rate-limit-exceeded': 'backend-limit:too-many-requests',
  'sign-in-limit-exceeded': 'backend-limit:too-many-sign-ins',
  'daily-quota-exceeded': 'backend-limit:daily-quota-spent',
}

/**
 * Says which of the backend's limits was reached, once, wherever it happened.
 *
 * Every request goes through one function in the API service, so the reason
 * is raised there; this is the one place that turns it into a sentence. Doing
 * it per call site would mean the same three messages written into every
 * screen that can talk to VRChat, and the ones nobody remembered would keep
 * showing the generic error (#170).
 */
export function useBackendLimitNotice(): void {
  const { t } = useLocalization()

  // `t` is a new function on every render, so subscribing on it would tear
  // this down and rebuild it constantly. Kept current from an effect rather
  // than during render, as `use-pulled-preferences` does.
  const tRef = useRef(t)
  useEffect(() => {
    tRef.current = t
  })

  useEffect(() => {
    return subscribeToBackendLimitReached((kind) => {
      toast(tRef.current('backend-limit:title'), {
        description: tRef.current(descriptionKeys[kind]),
        duration: 8000,
      })
    })
  }, [])
}
