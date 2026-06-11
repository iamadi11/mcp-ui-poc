import { describe, it, expect } from 'vitest'
import { listDesignSystems, getDesignSystem, setActiveDesignSystem } from '../src/design-systems/registry.js'

describe('design-systems registry', () => {
  it('registers glass, shadcn, material, plain with glass active by default', () => {
    const systems = listDesignSystems()
    expect(systems.map((s) => s.id)).toEqual(['glass', 'shadcn', 'material', 'plain'])
    expect(systems.find((s) => s.id === 'glass').active).toBe(true)
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

  it('switches the active design system', () => {
    setActiveDesignSystem('material')
    expect(getDesignSystem().id).toBe('material')
    setActiveDesignSystem('glass')
  })
})
