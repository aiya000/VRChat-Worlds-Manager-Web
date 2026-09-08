import { describe, expect, it } from 'vitest'
import {
  controlScaleFor,
  normalizeUiScale,
  panelScaleFor,
  UI_SCALES,
} from '@/lib/ui-scale'

describe('the two multipliers behind one scale setting', () => {
  it('draws the controls at the chosen size', () => {
    expect(controlScaleFor(100)).toBe(1)
    expect(controlScaleFor(150)).toBe(1.5)
    expect(controlScaleFor(200)).toBe(2)
  })

  it('grows what surrounds them by half as much', () => {
    expect(panelScaleFor(100)).toBe(1)
    expect(panelScaleFor(150)).toBe(1.25)
    expect(panelScaleFor(200)).toBe(1.5)
  })

  it('never lets the panel outgrow its controls', () => {
    for (const scale of UI_SCALES) {
      expect(panelScaleFor(scale)).toBeLessThanOrEqual(controlScaleFor(scale))
    }
  })

  it('falls back to 100% for anything it does not know', () => {
    expect(normalizeUiScale('150')).toBe(150)
    expect(normalizeUiScale(175)).toBe(175)
    expect(normalizeUiScale(160)).toBe(100)
    expect(normalizeUiScale(undefined)).toBe(100)
  })
})
