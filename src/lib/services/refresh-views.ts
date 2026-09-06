import { mutate } from 'swr'
import { useWorldsStore } from '@/app/listview/hook/use-worlds'

/**
 * Makes every list on screen read the database again.
 *
 * A pull writes another device's changes straight into Dexie, and nothing in
 * this app watches Dexie -- folders come from SWR, worlds from a store, and
 * both hold what they last read. Without this a sync that worked leaves the
 * screen exactly as it was, which is indistinguishable from one that did not
 * run at all.
 *
 * Failures are swallowed on purpose: this runs after a sync that has already
 * succeeded, so the data is safe either way, and the next navigation reads it.
 */
export async function refreshViews(): Promise<void> {
  await Promise.allSettled([
    mutate('folders'),
    useWorldsStore.getState().reloadAll(),
  ])
}
