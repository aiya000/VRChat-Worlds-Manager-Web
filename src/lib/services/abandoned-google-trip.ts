import { GOOGLE_AUTH_PENDING_RETURN_KEY } from '@/lib/google-auth-flow'
import { endSync, syncActivity } from './sync-activity'

/**
 * Gives up a departure for Google that the browser undid.
 *
 * A press that leaves deliberately does not put its button back: the page is
 * about to be replaced, and an idle button for the last frame before it goes
 * is a flicker nobody asked for. Pressing back does not replace the page --
 * the back/forward cache hands the very same JavaScript context back (#159) --
 * so the claim `tryBeginSync` took stays taken, and every later press is
 * refused for as long as the tab lives.
 *
 * The note of where the trip was going goes with it. Nothing came back to
 * read it, its ten minutes would expire unread, and the next press writes its
 * own.
 */
export function abandonGoogleTrip(): void {
  if (syncActivity().running) {
    // Not a sync time: nothing synced.
    endSync(null)
  }
  localStorage.removeItem(GOOGLE_AUTH_PENDING_RETURN_KEY)
}
