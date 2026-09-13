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
 * Whether this device still owes itself the preset worlds.
 *
 * It is written when the setup finishes on "start with nothing" and read on
 * the first list view after that, rather than seeded during the setup itself:
 * the worlds come from VRChat, and nobody is signed in until the setup is
 * over.
 *
 * `localStorage` for the same reason `setupComplete` is there -- this is about
 * one device's first run, and must not travel to another device through the
 * Drive sync. Every access is guarded: a browser with site data blocked throws
 * on the property itself, and the app has to keep working without the preset
 * rather than not load.
 */
const PENDING_KEY = 'presetWorldsPending'

export function markPresetWorldsPending(): void {
  try {
    localStorage.setItem(PENDING_KEY, 'true')
  } catch (e) {
    console.error(`Failed to mark the preset worlds as pending: ${e}`)
  }
}

export function isPresetWorldsPending(): boolean {
  try {
    return localStorage.getItem(PENDING_KEY) === 'true'
  } catch {
    return false
  }
}

export function clearPresetWorldsPending(): void {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch (e) {
    console.error(`Failed to clear the preset worlds flag: ${e}`)
  }
}
