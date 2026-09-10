/** Where a finger was, and when it was there. */
export interface SwipePoint {
  x: number
  y: number
  at: number
}

/**
 * Far enough that a tap, or the wobble of a finger held still, cannot reach it.
 * A phone is around 390px across, so this is roughly a fifth of the screen.
 */
const MIN_DISTANCE = 72

/**
 * A swipe is a flick, not a drag. Anything slower is someone moving a finger
 * about the screen while deciding, and opening the drawer under it would be a
 * surprise.
 */
const MAX_DURATION = 700

/**
 * A swipe rightwards across the screen, as a phone's navigation drawer is
 * pulled open.
 */
export function isRightwardSwipe(start: SwipePoint, end: SwipePoint): boolean {
  return isSwipeAlong(start, end, 1)
}

/** A swipe leftwards, as that same drawer is pushed back out of the way. */
export function isLeftwardSwipe(start: SwipePoint, end: SwipePoint): boolean {
  return isSwipeAlong(start, end, -1)
}

/**
 * The vertical limit is what keeps a swipe apart from scrolling the world
 * grid: the movement has to be at least twice as far across as it is up or
 * down before it counts, so a scroll that drifted sideways stays a scroll.
 */
function isSwipeAlong(
  start: SwipePoint,
  end: SwipePoint,
  direction: 1 | -1,
): boolean {
  const distanceX = (end.x - start.x) * direction
  const distanceY = end.y - start.y

  if (end.at - start.at > MAX_DURATION) {
    return false
  }
  if (distanceX < MIN_DISTANCE) {
    return false
  }
  return Math.abs(distanceY) * 2 < distanceX
}
