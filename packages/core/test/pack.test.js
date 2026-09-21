import { describe, it, expect } from 'vitest'
import {
  parseCssVariables,
  parseTokensJson,
  sanitizeCss,
  catalogFromPack,
  normalizePack,
  packHash,
} from '../src/design-systems/pack.js'
import { applyPolicy } from '../src/layout-policy.js'
import { getDesignSystem } from '../src/design-systems/registry.js'
import { buildJevQuestions, answersToPolicy } from '../src/jev/planner.js'
import { inferShape, fingerprint } from '../src/shape.js'

describe('design system packs', () => {
  it('maps shadcn CSS variables into tokens', () => {
    const pack = parseCssVariables(':root { --background: #111111; --foreground: #eeeeee; --primary: #0F766E; --radius: 12px; }')
    expect(pack.tokens.background).toBe('#111111')
    expect(pack.tokens.ink).toBe('#eeeeee')
    expect(pack.tokens.accent).toBe('#0F766E')
    expect(pack.tokens.radius).toBe('12px')
  })

  it('strips dangerous CSS', () => {
    const css = sanitizeCss('@import url("https://evil"); body{background:url(javascript:alert(1))} expression(alert(1)) <script>')
    expect(css).not.toMatch(/@import/)
    expect(css).not.toMatch(/javascript:/i)
    expect(css).not.toMatch(/expression/i)
    expect(css).not.toMatch(/script/i)
  })

  it('omits unsupported catalog types from supports', () => {
    const pack = normalizePack({ supports: ['login-form', 'chart', 'not-real'] })
    expect(pack.supports).toEqual(['login-form', 'chart'])
    expect(catalogFromPack(pack)).not.toContain('table')
  })

  it('omits chart from Jev questions when the pack does not support it', () => {
    const q = buildJevQuestions({ fields: [{ key: 'name', type: 'string' }] }, { catalogTypes: ['login-form'] })
    expect(q.named_widget.criteria.chart).toBeUndefined()
    expect(q.include_chart).toBeUndefined()
    expect(q.chart_type).toBeUndefined()
    const policy = answersToPolicy(
      { named_widget: { choice: 'chart' }, include_chart: { noul: 0.9 } },
      inferShape({ name: 'Ada' }),
      { catalogTypes: ['login-form'] },
    )
    expect(policy.componentTypes).not.toContain('chart')
    expect(policy.componentTypes).toEqual(['login-form'])
  })

  it('renders login with a custom accent', () => {
    const pack = parseTokensJson({
      tokens: { accent: '#b45309', onAccent: '#fff' },
    })
    const spec = applyPolicy({ componentTypes: ['login-form'], title: 'Acme' }, { store: 'Acme' }, 'demo:login')
    const html = getDesignSystem('shadcn').render(spec, pack)
    expect(html).toContain('--pack-accent:#b45309')
    expect(html).toMatch(/Acme/)
  })

  it('changes the fingerprint when the pack hash changes', () => {
    const shape = inferShape([{ id: 1, name: 'Ada' }])
    const a = packHash({ tokens: { accent: '#0F766E' } })
    const b = packHash({ tokens: { accent: '#b45309' } })
    expect(fingerprint(shape, 'login', 'shadcn', a)).not.toBe(fingerprint(shape, 'login', 'shadcn', b))
  })
})
