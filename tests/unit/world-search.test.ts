import { describe, expect, it } from 'vitest'

import {
  hasAnyTag,
  matchesTagFilters,
  matchesTextQuery,
} from '@/lib/world-search'

const WORLD = { name: 'ひみつの森', authorName: 'Someone' }

describe('matching a world against the typed words', () => {
  it('lets everything through when nothing was typed', () => {
    expect(matchesTextQuery(WORLD, '')).toBe(true)
    expect(matchesTextQuery(WORLD, '   ')).toBe(true)
  })

  it('matches part of the name, whatever the case', () => {
    expect(matchesTextQuery(WORLD, 'ひみつ')).toBe(true)
    expect(matchesTextQuery({ ...WORLD, name: 'Quiet Forest' }, 'forest')).toBe(
      true,
    )
  })

  it('matches the author as well as the name', () => {
    expect(matchesTextQuery(WORLD, 'someone')).toBe(true)
  })

  it('answers a kana name typed in romaji', () => {
    expect(matchesTextQuery(WORLD, 'himitsu')).toBe(true)
  })

  it('says no to words that are on neither', () => {
    expect(matchesTextQuery(WORLD, 'desert')).toBe(false)
  })
})

describe('matching a world against the chosen tags', () => {
  it('lets everything through when none are chosen', () => {
    expect(matchesTagFilters([], [])).toBe(true)
    expect(matchesTagFilters(['author_tag_chill'], [])).toBe(true)
  })

  it('keeps a world with no tags out as soon as one is chosen', () => {
    expect(matchesTagFilters([], ['chill'])).toBe(false)
  })

  it("finds a tag under VRChat's own spelling", () => {
    expect(matchesTagFilters(['author_tag_chill'], ['chill'])).toBe(true)
  })

  it('finds a tag added here, given with or without its prefix', () => {
    expect(matchesTagFilters(['custom:chill'], ['chill'])).toBe(true)
    expect(matchesTagFilters(['custom:chill'], ['custom:chill'])).toBe(true)
  })

  it('wants every chosen tag, not merely one of them', () => {
    const tags = ['author_tag_chill', 'author_tag_game']
    expect(matchesTagFilters(tags, ['chill', 'game'])).toBe(true)
    expect(matchesTagFilters(tags, ['chill', 'horror'])).toBe(false)
  })
})

describe('excluding by tag', () => {
  it('excludes nothing when no tag was named', () => {
    expect(hasAnyTag(['author_tag_chill'], [])).toBe(false)
  })

  it('excludes a world carrying any one of the named tags', () => {
    expect(hasAnyTag(['author_tag_chill'], ['horror', 'chill'])).toBe(true)
  })

  it('leaves a world alone when it carries none of them', () => {
    expect(hasAnyTag(['author_tag_chill'], ['horror'])).toBe(false)
    expect(hasAnyTag([], ['horror'])).toBe(false)
  })
})
