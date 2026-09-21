import { describe, it, expect } from 'vitest'
import { isSafeHttpUrl } from '../src/safe-url.js'

describe('isSafeHttpUrl', () => {
  it('allows absolute http(s) URLs', () => {
    expect(isSafeHttpUrl('https://example.com/path')).toBe(true)
    expect(isSafeHttpUrl('http://api.example.com')).toBe(true)
  })

  it('rejects dangerous or non-http schemes', () => {
    expect(isSafeHttpUrl('javascript:alert(1)')).toBe(false)
    expect(isSafeHttpUrl('data:text/html,hi')).toBe(false)
    expect(isSafeHttpUrl('file:///etc/passwd')).toBe(false)
    expect(isSafeHttpUrl('blob:https://example.com/x')).toBe(false)
  })

  it('rejects relative, empty, and invalid values', () => {
    expect(isSafeHttpUrl('#')).toBe(false)
    expect(isSafeHttpUrl('/relative')).toBe(false)
    expect(isSafeHttpUrl('')).toBe(false)
    expect(isSafeHttpUrl(null)).toBe(false)
    expect(isSafeHttpUrl('not a url')).toBe(false)
  })
})
