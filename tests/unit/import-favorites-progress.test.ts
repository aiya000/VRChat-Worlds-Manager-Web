import { describe, expect, it } from 'vitest'
import {
  FETCH_STEPS,
  fetchStepPercentage,
  importProgressPercentage,
} from '@/app/listview/settings/components/popups/import-favorites-progress'

describe('fetchStepPercentage', () => {
  it('ends at 100 on the last step', () => {
    expect(fetchStepPercentage(FETCH_STEPS[FETCH_STEPS.length - 1])).toBe(100)
  })

  it('never reports 0, so the first step already looks alive', () => {
    for (const step of FETCH_STEPS) {
      expect(fetchStepPercentage(step)).toBeGreaterThan(0)
    }
  })

  it('rises as the steps go on', () => {
    const percentages = FETCH_STEPS.map(fetchStepPercentage)
    for (let i = 1; i < percentages.length; i += 1) {
      expect(percentages[i]).toBeGreaterThan(percentages[i - 1])
    }
  })
})

describe('importProgressPercentage', () => {
  it('reports whole percentages', () => {
    expect(importProgressPercentage(0, 8)).toBe(0)
    expect(importProgressPercentage(1, 3)).toBe(33)
    expect(importProgressPercentage(8, 8)).toBe(100)
  })

  it('calls nothing to import finished rather than stuck at zero', () => {
    expect(importProgressPercentage(0, 0)).toBe(100)
  })
})
