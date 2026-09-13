import { useEffect, useState } from 'react'
import { commands } from '@/lib/commands'
import {
  PRESET_WORLD_IDS,
  clearPresetWorldsPending,
  isPresetWorldsPending,
  presetWorldDateAdded,
} from '@/lib/preset-worlds'
import { refreshViews } from '@/lib/services/refresh-views'
import { worldForCollection } from '@/lib/world-collection'

export type UsePresetWorldsResult = {
  /** Whether to tell the reader that the worlds below were put there. */
  isNoticeOpen: boolean
  dismissNotice: () => void
}

/**
 * Puts the preset worlds into the collection, once, on the first list view
 * after a setup that started with nothing.
 *
 * Two things are deliberate about how it fails:
 *
 * - **Nothing is written unless all ten arrived.** VRChat is asked for each in
 *   turn and the rows are held back until the last one answers, so a device
 *   that was offline, rate-limited or signed out gets no half a preset and no
 *   notice claiming one. The flag stays, and the next list view tries again
 * - **The world-details rows each request leaves behind are kept.** They are a
 *   cache the detail popup reads, they are correct whether or not the rest of
 *   the run succeeded, and throwing them away would only mean asking VRChat
 *   for them twice
 */
export function usePresetWorlds(): UsePresetWorldsResult {
  const [isNoticeOpen, setIsNoticeOpen] = useState(false)

  useEffect(() => {
    if (!isPresetWorldsPending()) {
      return
    }

    let leftTheList = false

    const seed = async () => {
      const base = Date.now()
      const worlds = []

      for (const [index, worldId] of PRESET_WORLD_IDS.entries()) {
        // `getWorld` rather than `checkWorldInfo`: it fills the world-details
        // table on the way past, so the detail popup of a preset world opens
        // without asking VRChat again.
        const result = await commands.getWorld(worldId, null)
        if (result.status === 'error') {
          console.error(
            `Preset world ${worldId} could not be fetched, so none were added: ${result.error.message}`,
          )
          return
        }
        worlds.push({
          ...worldForCollection(result.data),
          dateAdded: presetWorldDateAdded(index, base),
        })
      }

      for (const world of worlds) {
        const remembered = await commands.rememberWorld(world)
        if (remembered.status === 'error') {
          console.error(`Failed to add a preset world: ${remembered.error}`)
          return
        }
      }

      // Only now: until this point the run could still have ended with nothing
      // written, and a cleared flag would have spent the one chance to do it.
      clearPresetWorldsPending()

      // Nothing here watches Dexie, so the grid is still showing the empty
      // collection it read on mount until this says otherwise.
      await refreshViews()

      if (leftTheList) {
        return
      }
      setIsNoticeOpen(true)
    }

    seed()

    return () => {
      leftTheList = true
    }
  }, [])

  return {
    isNoticeOpen,
    dismissNotice: () => setIsNoticeOpen(false),
  }
}
