/**
 * Throws away everything that could hand this bundle back again.
 *
 * Reloading on its own is not an escape. The usual reason an out-of-date
 * bundle is on screen at all is that a service worker answered with it out of
 * its cache, and it will answer the reload exactly the same way -- so the
 * notice comes back, the button does nothing, and there is no way out from
 * inside the app. Dropping the worker and its caches is what makes the next
 * load reach the network.
 *
 * Every step is allowed to fail. A browser with no service workers, or one
 * that refuses to look, should still get the reload that follows: it is the
 * only part that can help on its own, and it must not be skipped because a
 * cleanup step threw.
 */
export async function discardCachedBundle(): Promise<void> {
  await Promise.allSettled([unregisterWorkers(), deleteCaches()])
}

async function unregisterWorkers(): Promise<void> {
  if (
    typeof navigator === 'undefined' ||
    navigator.serviceWorker === undefined
  ) {
    return
  }
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.allSettled(
    registrations.map((registration) => registration.unregister()),
  )
}

async function deleteCaches(): Promise<void> {
  if (typeof caches === 'undefined') {
    return
  }
  const names = await caches.keys()
  await Promise.allSettled(names.map((name) => caches.delete(name)))
}
