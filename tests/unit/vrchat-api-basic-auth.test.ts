import { describe, expect, it } from 'vitest'
import { basicAuthCredential } from '@/lib/services/vrchat-api'

function decode(credential: string): string {
  return atob(credential)
}

describe('basicAuthCredential', () => {
  it('percent-encodes each half before joining them', () => {
    expect(decode(basicAuthCredential('someone', 'pass word'))).toBe(
      'someone:pass%20word',
    )
  })

  it('survives a username outside Latin-1', () => {
    // `btoa` throws `InvalidCharacterError` on such a name unencoded, which is
    // what stopped a Japanese account from signing in at all. The parentheses
    // are the full-width ones a VRChat display name can hold.
    const name = 'やまだ たろう（ふたつめ）'
    const credential = basicAuthCredential(name, 'hunter2')

    expect(decode(credential)).toBe(`${encodeURIComponent(name)}:hunter2`)
  })

  it('survives a password outside Latin-1', () => {
    expect(() => basicAuthCredential('someone', 'パスワード')).not.toThrow()
  })

  it('keeps the colon between the two halves and nowhere else', () => {
    // An encoded half can never contain a bare `:`, so the split is
    // unambiguous no matter what either half holds.
    expect(decode(basicAuthCredential('a:b', 'c:d')).split(':')).toHaveLength(2)
  })

  it('leaves an ordinary ASCII pair alone', () => {
    expect(decode(basicAuthCredential('aiya000', 'hunter2'))).toBe(
      'aiya000:hunter2',
    )
  })
})
