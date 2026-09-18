import { describe, it, expect } from 'vitest'
import { listDesignSystems, getDesignSystem, setActiveDesignSystem } from '../src/design-systems/registry.js'

describe('design-systems registry', () => {
  it('registers shadcn, glass, material, plain with shadcn active by default', () => {
    const systems = listDesignSystems()
    expect(systems.map((s) => s.id)).toEqual(['shadcn', 'glass', 'material', 'plain'])
    expect(systems.find((s) => s.id === 'shadcn').active).toBe(true)
  })

  it('renders a page spec to a full HTML document', () => {
    const glass = getDesignSystem('glass')
    const html = glass.render({
      title: 'Test',
      summary: 'A test',
      presentation: 'page',
      components: [{ type: 'text', props: { content: 'hello' } }],
    })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('hello')
    expect(html).toContain('<h1>Test</h1>')
  })

  it('renders nested object cells as readable scalars, not raw JSON', () => {
    const glass = getDesignSystem('glass')
    const html = glass.render({
      title: 'Users',
      summary: 't',
      presentation: 'page',
      components: [{
        type: 'table',
        props: {
          columns: [{ key: 'name', label: 'name' }, { key: 'address', label: 'address' }],
          rows: [{ name: 'Leanne', address: { street: 'Kulas Light', city: 'Gwenborough' } }],
        },
      }],
    })
    expect(html).toContain('Kulas Light, Gwenborough')
    expect(html).not.toContain('{"street"')
  })

  it('renders "component" presentation as bare markup with no page chrome', () => {
    const shadcn = getDesignSystem('shadcn')
    const html = shadcn.render({
      title: 'Temp',
      summary: 'x',
      presentation: 'component',
      components: [{ type: 'text', props: { content: 'just the widget' } }],
    })
    expect(html).toContain('just the widget')
    expect(html).not.toContain('<h1>')
    expect(html).not.toContain('modal-backdrop')
  })

  it('renders a line chart with sparse axis ticks, not one label per point', () => {
    const shadcn = getDesignSystem('shadcn')
    const html = shadcn.render({
      title: 'Temperature',
      summary: 't',
      presentation: 'page',
      components: [{
        type: 'chart',
        title: 'Temperature',
        props: {
          chartType: 'line',
          values: [20, 21, 22, 24, 28, 30, 29, 27],
          labels: ['Sep 18, 12 AM', '1 AM', '2 AM', '3 AM', '4 AM', '5 AM', '6 AM', '7 AM'],
        },
      }],
    })
    expect(html).toContain('polyline')
    expect(html).toContain('#0F766E')
    expect((html.match(/class="axis"/g) || []).length).toBe(1)
    const axis = html.match(/<div class="axis">([\s\S]*?)<\/div>/)?.[1] || ''
    expect(axis.split('Sep 18, 12 AM').length - 1).toBe(1)
    expect(html).toContain('chart-tooltip')
  })

  it('switches the active design system', () => {
    setActiveDesignSystem('material')
    expect(getDesignSystem().id).toBe('material')
    setActiveDesignSystem('shadcn')
  })
})
