import { describe, expect, it } from 'vitest'
import {
  buildGoogleAuthUrl,
  GOOGLE_AUTH_RETURN_PATH,
  isSafeReturnPath,
  parseGoogleAuthReturn,
} from '@/lib/google-auth-flow'

describe('buildGoogleAuthUrl', () => {
  const url = new URL(
    buildGoogleAuthUrl({
      origin: 'https://example.test',
      state: 'abc123',
    }),
  )

  it('asks Google for a token in the fragment, not a code', () => {
    expect(url.origin + url.pathname).toBe(
      'https://accounts.google.com/o/oauth2/v2/auth',
    )
    expect(url.searchParams.get('response_type')).toBe('token')
  })

  it('comes back to the return path on the origin it left from', () => {
    expect(url.searchParams.get('redirect_uri')).toBe(
      `https://example.test${GOOGLE_AUTH_RETURN_PATH}`,
    )
  })

  it('carries the state it will be checked against', () => {
    expect(url.searchParams.get('state')).toBe('abc123')
  })

  it('asks for nothing beyond the files this app creates', () => {
    expect(url.searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/drive.file',
    )
  })
})

describe('parseGoogleAuthReturn', () => {
  it('reads a granted token, with or without the leading hash', () => {
    const expected = {
      kind: 'granted',
      accessToken: 'ya29.token',
      expiresInSeconds: 3599,
      state: 's1',
    }
    expect(
      parseGoogleAuthReturn(
        '#access_token=ya29.token&token_type=Bearer&expires_in=3599&state=s1',
      ),
    ).toEqual(expected)
    expect(
      parseGoogleAuthReturn(
        'access_token=ya29.token&token_type=Bearer&expires_in=3599&state=s1',
      ),
    ).toEqual(expected)
  })

  it('assumes the usual hour when Google leaves expires_in out', () => {
    expect(parseGoogleAuthReturn('#access_token=t&state=s1')).toMatchObject({
      kind: 'granted',
      expiresInSeconds: 3600,
    })
  })

  it('reports a refusal by its reason', () => {
    expect(parseGoogleAuthReturn('#error=access_denied&state=s1')).toEqual({
      kind: 'denied',
      reason: 'access_denied',
      state: 's1',
    })
  })

  it('sees nothing in a fragment without a state, whatever else it holds', () => {
    expect(parseGoogleAuthReturn('#access_token=t')).toEqual({
      kind: 'nothing',
    })
    expect(parseGoogleAuthReturn('')).toEqual({ kind: 'nothing' })
    expect(parseGoogleAuthReturn('#')).toEqual({ kind: 'nothing' })
  })

  it('sees nothing in a state with neither token nor error', () => {
    expect(parseGoogleAuthReturn('#state=s1')).toEqual({ kind: 'nothing' })
    expect(parseGoogleAuthReturn('#state=s1&access_token=')).toEqual({
      kind: 'nothing',
    })
  })
})

describe('isSafeReturnPath', () => {
  it('accepts a path on this origin, query and all', () => {
    expect(isSafeReturnPath('/listview/settings?tab=sync')).toBe(true)
    expect(isSafeReturnPath('/setup?resume=drive')).toBe(true)
  })

  it('refuses anything that would leave the origin', () => {
    expect(isSafeReturnPath('https://evil.example/')).toBe(false)
    expect(isSafeReturnPath('//evil.example/')).toBe(false)
    expect(isSafeReturnPath('/\\evil.example/')).toBe(false)
    expect(isSafeReturnPath('')).toBe(false)
  })
})
