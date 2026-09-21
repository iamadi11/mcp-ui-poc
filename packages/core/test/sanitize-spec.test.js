import { describe, it, expect } from 'vitest'
import { collectHttpUrls, sanitizeSpecActions } from '../src/sanitize-spec.js'

describe('collectHttpUrls', () => {
  it('collects nested http(s) strings only', () => {
    const urls = collectHttpUrls({
      a: 'https://ok.example/x',
      b: ['javascript:alert(1)', { href: 'http://also.example' }],
      c: '/relative',
    })
    expect([...urls].sort()).toEqual(['http://also.example', 'https://ok.example/x'])
  })
})

describe('sanitizeSpecActions', () => {
  it('keeps action-row links that match sourceUrl or data', () => {
    const spec = {
      components: [
        {
          type: 'action-row',
          props: {
            actions: [
              { label: 'Source', action: 'link', url: 'https://api.example.com/data' },
              { label: 'Field', action: 'link', url: 'https://cdn.example.com/img.png' },
            ],
          },
        },
      ],
    }
    const next = sanitizeSpecActions(spec, {
      sourceUrl: 'https://api.example.com/data',
      data: { image: 'https://cdn.example.com/img.png' },
    })
    expect(next.components[0].props.actions).toEqual([
      { label: 'Source', action: 'link', url: 'https://api.example.com/data' },
      { label: 'Field', action: 'link', url: 'https://cdn.example.com/img.png' },
    ])
  })

  it('converts unknown or unsafe links to notify', () => {
    const spec = {
      components: [
        {
          type: 'action-row',
          props: {
            actions: [
              { label: 'Phish', action: 'link', url: 'https://evil.example/phish' },
              { label: 'Js', action: 'link', url: 'javascript:alert(1)' },
            ],
          },
        },
      ],
    }
    const next = sanitizeSpecActions(spec, {
      sourceUrl: 'https://api.example.com/data',
      data: { ok: true },
    })
    expect(next.components[0].props.actions.every((a) => a.action === 'notify')).toBe(true)
    expect(next.components[0].props.actions[0].url).toBeUndefined()
  })
})
