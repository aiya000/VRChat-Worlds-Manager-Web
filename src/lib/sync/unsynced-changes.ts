/**
 * Whether this device has changed something since it last synced.
 *
 * Syncing happens only when someone presses the button (#124), so the button
 * has to be able to say "there is something here worth pressing for". Both
 * moments are plain timestamps: the last local change is recorded as it
 * happens, the last sync is what the sync itself remembered.
 */
export function hasUnsyncedChanges(
  localChangedAt: number | null,
  lastSyncedAt: number | null,
): boolean {
  if (localChangedAt === null) {
    return false
  }
  if (lastSyncedAt === null) {
    return true
  }
  return localChangedAt > lastSyncedAt
}
