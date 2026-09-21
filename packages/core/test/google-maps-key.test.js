import { describe, it, expect } from 'vitest'
import { sanitizeGoogleMapsKey, runWithGoogleMapsKey, googleMapsKey } from '../src/google-maps-key.js'

describe('sanitizeGoogleMapsKey', () => {
  it('accepts a browser-length Maps key and rejects junk', () => {
    expect(sanitizeGoogleMapsKey('AIzaSyTestKeyThatIsLongEnough12')).toBe('AIzaSyTestKeyThatIsLongEnough12')
    expect(sanitizeGoogleMapsKey(' short ')).toBe('')
    expect(sanitizeGoogleMapsKey('https://evil.example/key')).toBe('')
    expect(sanitizeGoogleMapsKey('')).toBe('')
  })

  it('scopes a request key without leaking into the next call', async () => {
    const key = 'AIzaSyScopedKeyForThisCallOnly1'
    const seen = await runWithGoogleMapsKey(key, () => googleMapsKey())
    expect(seen).toBe(key)
  })
})
