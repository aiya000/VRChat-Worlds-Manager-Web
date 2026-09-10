import { describe, expect, it } from 'vitest'

import {
  isLeftwardSwipe,
  isRightwardSwipe,
  type SwipePoint,
} from '@/lib/swipe-gesture'

const START: SwipePoint = { x: 40, y: 400, at: 0 }

const to = (x: number, y: number, at: number): SwipePoint => ({ x, y, at })

describe('recognising the swipe that opens the drawer', () => {
  it('takes a flick to the right', () => {
    expect(isRightwardSwipe(START, to(200, 410, 200))).toBe(true)
  })

  it('takes one that started in the middle of the screen', () => {
    expect(isRightwardSwipe({ x: 200, y: 400, at: 0 }, to(320, 400, 200))).toBe(
      true,
    )
  })

  it('refuses a flick to the left', () => {
    expect(isRightwardSwipe({ x: 300, y: 400, at: 0 }, to(100, 400, 200))).toBe(
      false,
    )
  })

  it('refuses a tap, and the wobble of a finger held still', () => {
    expect(isRightwardSwipe(START, to(40, 400, 100))).toBe(false)
    expect(isRightwardSwipe(START, to(48, 403, 100))).toBe(false)
  })

  it('refuses a scroll that drifted sideways', () => {
    expect(isRightwardSwipe(START, to(160, 620, 200))).toBe(false)
  })

  it('refuses a finger moved about the screen slowly', () => {
    expect(isRightwardSwipe(START, to(200, 410, 1500))).toBe(false)
  })
})

describe('recognising the swipe that shuts the drawer', () => {
  const FROM_DRAWER: SwipePoint = { x: 240, y: 400, at: 0 }

  it('takes a flick to the left', () => {
    expect(isLeftwardSwipe(FROM_DRAWER, to(60, 410, 200))).toBe(true)
  })

  it('refuses a flick to the right', () => {
    expect(isLeftwardSwipe(FROM_DRAWER, to(380, 400, 200))).toBe(false)
  })

  it('refuses a scroll down the folder list that drifted sideways', () => {
    expect(isLeftwardSwipe(FROM_DRAWER, to(120, 620, 200))).toBe(false)
  })
})
