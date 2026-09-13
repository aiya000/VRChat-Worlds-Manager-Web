import { useEffect, useState, useSyncExternalStore } from 'react'
import { commands } from '@/lib/commands'
import {
  PRESET_WORLD_IDS,
  isPresetNoticeOwed,
  isPresetWorldsPending,
  isSeedingPresetWorlds,
  presetNoticeShown,
  presetWorldDateAdded,
  presetWorldsAdded,
  setSeedingPresetWorlds,
  subscribeToPresetSeeding,
} from '@/lib/preset-worlds'
import { refreshViews } from '@/lib/services/refresh-views'
import { worldForCollection } from '@/lib/world-collection'

export type UsePresetWorldsResult = {
  /**
   * Whether the worlds are on their way. The grid shows a spinner for this and
   * nothing else -- an empty collection that is about to stop being empty
   * otherwise reads as an app that did not react to being opened.
   */
  isSeeding: boolean
  /** Whether to tell the reader that the worlds below were put there. */
  isNoticeOpen: boolean
  dismissNotice: () => void
}

/**
 * Puts the preset worlds into the collection, once, on the first list view
 * after a setup that started with nothing.
 *
 * Three things are deliberate about how it behaves when it is left alone:
 *
 * - **Nothing is written unless all ten arrived.** VRChat is asked for each in
 *   turn and the rows are held back until the last one answers, so a device
 *   that was offline, rate-limited or signed out gets no half a preset and no
 *   notice claiming one. What is owed stays owed, and the next list view tries
 *   again -- the spinner simply stops, with nothing said
 * - **Leaving the list does not cancel it.** The awaits run to the end and the
 *   worlds land either way; what waits is the notice, which is owed to the
 *   reader rather than to the screen that started the run, and so is shown by
 *   whichever list view is open when there is one to show
 * - **Only one run at a time.** The flag saying a run is in flight lives
 *   outside the component, so the next folder page joins the run rather than
 *   starting a second one
 *
 * The world-details rows each request leaves behind are kept even when the run
 * ends with nothing written: they are a cache the detail popup reads, they are
 * correct either way, and dropping them would only mean asking VRChat twice.
 */
export function usePresetWorlds(): UsePresetWorldsResult {
  const [isNoticeOpen, setIsNoticeOpen] = useState(false)
  const isSeeding = useSyncExternalStore(
    subscribeToPresetSeeding,
    isSeedingPresetWorlds,
    // The server render has no run in flight and no local storage to ask.
    () => false,
  )

  useEffect(() => {
    if (!isPresetWorldsPending() || isSeedingPresetWorlds()) {
      return
    }
    setSeedingPresetWorlds(true)

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
      // written, and marking it done would have spent the one chance to do it.
      presetWorldsAdded()

      // Nothing here watches Dexie, so every list on screen is still showing
      // the empty collection it read on mount until this says otherwise.
      await refreshViews()
    }

    seed().finally(() => setSeedingPresetWorlds(false))
  }, [])

  // Runs on mount, and again the moment a run finishes. Both matter: the
  // notice may be owed from a session that ended before anyone read it.
  useEffect(() => {
    const showIfOwed = () => {
      if (!isSeeding && isPresetNoticeOwed()) {
        setIsNoticeOpen(true)
      }
    }
    showIfOwed()
  }, [isSeeding])

  return {
    isSeeding,
    isNoticeOpen,
    dismissNotice: () => {
      presetNoticeShown()
      setIsNoticeOpen(false)
    },
  }
}
