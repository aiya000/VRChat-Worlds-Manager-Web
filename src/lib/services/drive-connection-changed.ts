/**
 * A signal that this device connected to, or disconnected from, Google Drive.
 *
 * The connect button and the things that appear once connected live in
 * different cards, and each reads the connection state for itself. Without
 * this, pressing "connect" left the push-settings card unaware until the next
 * reload. Deliberately free of any import, like the other signals.
 */

type Listener = () => void

const listeners = new Set<Listener>()

export function notifyDriveConnectionChanged(): void {
  for (const listener of [...listeners]) {
    listener()
  }
}

export function subscribeToDriveConnectionChanged(
  listener: Listener,
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
