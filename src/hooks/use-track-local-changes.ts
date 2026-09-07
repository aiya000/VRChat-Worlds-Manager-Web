import { useEffect } from 'react'
import { startTrackingLocalChanges } from '@/lib/services/unsynced-changes'

/**
 * Keeps "when did this device last change something" up to date for as long
 * as the list view is mounted, which is where the sync button that reads it
 * lives. Nothing here syncs: a change is only recorded, and it is a press
 * that sends it (#124).
 */
export function useTrackLocalChanges(): void {
  useEffect(() => startTrackingLocalChanges(), [])
}
