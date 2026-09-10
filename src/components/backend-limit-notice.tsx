'use client'

import { useBackendLimitNotice } from '@/hooks/use-backend-limit-notice'

/**
 * Mounted at the root rather than inside the list view, because the limit
 * most likely to be reached -- the one on sign-in attempts -- is reached on
 * the login screen, which the list view's shell never wraps.
 */
export function BackendLimitNotice(): null {
  useBackendLimitNotice()
  return null
}
