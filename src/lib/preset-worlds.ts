/**
 * The worlds handed to someone who set the app up with nothing in it.
 *
 * An empty collection is an app with nothing to press: the grid, the folders,
 * the launch button and the delete all need a world to act on before any of
 * them mean anything. These ten give a first-run device something to try
 * every one of those on.
 *
 * The order is the order they were asked for, and it is the order they are
 * meant to read in, so it is written into `dateAdded` rather than left to
 * whatever order the requests happen to finish in -- see
 * `presetWorldDateAdded`.
 */
export const PRESET_WORLD_IDS = [
  'wrld_4432ea9b-729c-46e3-8eaf-846aa0a37fdd',
  'wrld_bf51e60f-f372-48b1-a757-88ba8331d926',
  'wrld_fae3fa95-bc18-46f0-af57-f0c97c0ca90a',
  'wrld_01e19bb8-dce9-4416-8d0d-dbcaa9324fb2',
  'wrld_3d12fbc0-c470-4e97-9191-3cf3aeba8832',
  'wrld_2bb48979-53f4-4f6f-9893-ebc837c1ce2c',
  'wrld_5855da31-030c-4abb-bfc4-20e7b2df4ab8',
  'wrld_4c9bdba1-fc50-47f1-99c0-30e453fe7153',
  'wrld_c02e7709-b0f2-4957-a97d-10b1fd4ac278',
  'wrld_88204da2-a487-46e9-8bfa-f3a5d3aeccb5',
] as const

/**
 * The list opens on "date added", newest first, so the first world asked for
 * has to carry the *latest* stamp. The spacing is a second apart rather than a
 * millisecond so the order survives being read back through a date string.
 */
export function presetWorldDateAdded(index: number, base: number): string {
  return new Date(base - index * 1000).toISOString()
}

/**
 * Two things this device may still owe itself, each written once and taken
 * once.
 *
 * They are separate because the run that fetches the worlds and the moment
 * someone is there to read about them are not the same moment: leaving the
 * list half way through still finishes the fetch, and the explanation then has
 * to wait for the next list view rather than be lost.
 *
 * `localStorage` for the same reason `setupComplete` is there -- this is about
 * one device's first run, and must not travel to another device through the
 * Drive sync. Every access is guarded: a browser with site data blocked throws
 * on the property itself, and the app has to keep working without the preset
 * rather than not load.
 */
const WORLDS_OWED_KEY = 'presetWorldsPending'
const NOTICE_OWED_KEY = 'presetWorldsNoticePending'

function read(key: string): boolean {
  try {
    return localStorage.getItem(key) === 'true'
  } catch {
    return false
  }
}

function write(key: string, owed: boolean): void {
  try {
    if (owed) {
      localStorage.setItem(key, 'true')
    } else {
      localStorage.removeItem(key)
    }
  } catch (e) {
    console.error(`Failed to record the preset worlds state (${key}): ${e}`)
  }
}

export function markPresetWorldsPending(): void {
  write(WORLDS_OWED_KEY, true)
}

export function isPresetWorldsPending(): boolean {
  return read(WORLDS_OWED_KEY)
}

/**
 * The one moment the worlds land: what was owed stops being the worlds and
 * starts being the sentence explaining them.
 */
export function presetWorldsAdded(): void {
  write(WORLDS_OWED_KEY, false)
  write(NOTICE_OWED_KEY, true)
}

export function isPresetNoticeOwed(): boolean {
  return read(NOTICE_OWED_KEY)
}

export function presetNoticeShown(): void {
  write(NOTICE_OWED_KEY, false)
}

/**
 * Whether a run is in flight, kept here rather than in the component that
 * started it.
 *
 * Every folder page mounts the same hook, so a page left half way through the
 * run would otherwise hand the next one a flag still saying "owed" and it
 * would start a second run of its own -- twenty requests for ten worlds. Kept
 * out here, the second page sees the first page's run instead, and shows the
 * same spinner for it.
 */
let seeding = false
const listeners = new Set<() => void>()

export function isSeedingPresetWorlds(): boolean {
  return seeding
}

export function setSeedingPresetWorlds(next: boolean): void {
  if (seeding === next) {
    return
  }
  seeding = next
  for (const listener of listeners) {
    listener()
  }
}

export function subscribeToPresetSeeding(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
