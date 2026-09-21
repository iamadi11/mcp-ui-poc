import { describe, it, expect } from 'vitest'
import { renderSpecHtml } from '../src/design-systems/spec-html.js'

const theme = {
  id: 'test',
  name: 'Test',
  head: '',
  css: '',
}

describe('action-row link scheme sanitize', () => {
  it('emits http(s) links as link actions', () => {
    const html = renderSpecHtml(
      {
        title: 'T',
        components: [
          {
            type: 'action-row',
            props: {
              actions: [{ label: 'Docs', url: 'https://example.com/docs' }],
            },
          },
        ],
      },
      theme,
    )
    expect(html).toMatch(/type&quot;:&quot;link&quot;/)
    expect(html).toMatch(/https:\/\/example\.com\/docs/)
  })

  it('does not emit javascript: or data: as link actions', () => {
    const html = renderSpecHtml(
      {
        title: 'T',
        components: [
          {
            type: 'action-row',
            props: {
              actions: [
                { label: 'Evil', url: 'javascript:alert(1)' },
                { label: 'Data', url: 'data:text/html,hi' },
              ],
            },
          },
        ],
      },
      theme,
    )
    expect(html).not.toMatch(/javascript:/i)
    expect(html).not.toMatch(/type&quot;:&quot;link&quot;/)
    expect(html).toMatch(/type&quot;:&quot;notify&quot;/)
    expect(html).toMatch(/Link blocked/)
  })
})
