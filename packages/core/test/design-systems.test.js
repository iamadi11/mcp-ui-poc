import { describe, it, expect } from 'vitest'
import { listDesignSystems, getDesignSystem, setActiveDesignSystem } from '../src/design-systems/registry.js'
import { runWithGoogleMapsKey } from '../src/google-maps-key.js'

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

  it('applies vivid look tokens when the spec asks for a colourful layout', () => {
    const shadcn = getDesignSystem('shadcn')
    const html = shadcn.render({
      title: 'Stride checkout',
      summary: 'Demo cart',
      presentation: 'page',
      look: 'vivid',
      motion: 'stagger',
      components: [{ type: 'stat-grid', props: { items: [{ label: 'Total', value: '$279' }] } }],
    })
    expect(html).toMatch(/<body[^>]*data-look="vivid"/)
    expect(html).toContain('[data-look="vivid"] .stat-value')
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

  it('paints shadcn widgets with MCP-UI paper/ink, not zinc', () => {
    const html = getDesignSystem('shadcn').render({
      title: 'Stride',
      summary: 'Demo',
      presentation: 'page',
      components: [{ type: 'stat-grid', props: { items: [{ label: 'Steps', value: '1' }] } }],
    })
    expect(html).toContain('#F8F9FB')
    expect(html).toContain('#0F172A')
    expect(html).toContain('#FFFFFF')
    expect(html).toContain('IBM Plex Sans')
    expect(html).toContain('JetBrains Mono')
    expect(html).not.toContain('#09090b')
    expect(html).toContain('section kpis')
  })

  it('renders a centered login-form card, not a records table', () => {
    const html = getDesignSystem('shadcn').render({
      title: 'Tata 1mg',
      summary: 'Sign in to Tata 1mg.',
      presentation: 'page',
      components: [{
        type: 'login-form',
        props: {
          brand: 'Tata 1mg',
          kicker: 'Account',
          subtitle: 'Sign in to Tata 1mg.',
          submitLabel: 'Sign in',
          fields: [
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'password', label: 'Password', type: 'password', required: true },
          ],
        },
      }],
    })
    expect(html).toContain('auth-card')
    expect(html).toContain('auth-mark')
    expect(html).toContain('Tata 1mg')
    expect(html).toContain('Sign in')
    expect(html).toContain('type="email"')
    expect(html).toContain('type="password"')
    expect(html).toContain('class="auth-page')
    expect(html).not.toContain('Records')
    expect(html).not.toContain('<table')
    const animated = getDesignSystem('shadcn').render({
      title: 'Tata 1mg',
      presentation: 'page',
      motion: 'stagger',
      components: [{
        type: 'login-form',
        props: { brand: 'Tata 1mg', submitLabel: 'Sign in', fields: [{ name: 'email', label: 'Email', type: 'email', required: true }] },
      }],
    })
    expect(animated).toMatch(/data-motion="stagger"/)
    expect(animated).toContain('.auth-card')
    expect(animated).toContain('mcp-enter')
  })

  it('renders landing as a page with hero measure, not equal-card kit labels', () => {
    const html = getDesignSystem('shadcn').render({
      title: 'Stride',
      summary: 'Landing',
      presentation: 'page',
      radius: '16px',
      components: [{
        type: 'landing-page',
        props: {
          brand: 'Stride',
          kicker: 'Stride',
          headline: 'Run further. Look sharper.',
          cta: 'Shop the drop',
          sections: [
            { kind: 'proof', copy: '12k runners this week' },
            { kind: 'product', copy: 'Aero Runner and Court Low', cta: 'Browse pairs' },
            { kind: 'footer', copy: 'Shipping in 2 days' },
          ],
        },
      }],
    })
    expect(html).toContain('land-hero')
    expect(html).toContain('Run further. Look sharper.')
    expect(html).toContain('land-flow')
    expect(html).toContain('--pack-radius:16px')
    expect(html).not.toContain('>PRODUCT<')
    expect(html).not.toContain('land-grid')
    expect(html).not.toContain('<table')
  })

  it('renders checkout as cart plus pay, and form/settings/calendar as those primitives', () => {
    const ds = getDesignSystem('shadcn')
    const checkout = ds.render({
      title: 'Stride',
      presentation: 'page',
      components: [{
        type: 'checkout',
        props: {
          brand: 'Stride',
          kicker: 'Checkout',
          lines: [{ product: 'Aero Runner', qty: 1, price: 129 }],
          totals: { total: 129 },
        },
      }],
    })
    expect(checkout).toContain('check-layout')
    expect(checkout).toContain('Pay now')
    expect(checkout).not.toContain('<table')
    const form = ds.render({
      title: 'Contact',
      presentation: 'page',
      components: [{
        type: 'form',
        props: {
          brand: 'Studio',
          fields: [{ name: 'email', label: 'Email', type: 'email', required: true }],
          submitLabel: 'Send',
        },
      }],
    })
    expect(form).toContain('type="email"')
    expect(form).toContain('Send')
    expect(form).toContain('auth-card')
    expect(form).toContain('class="auth-page')
    const settings = ds.render({
      title: 'Account settings',
      presentation: 'page',
      components: [{
        type: 'settings',
        props: {
          brand: 'Account settings',
          sections: [{ name: 'Profile', fields: [{ name: 'name', label: 'Name', type: 'text' }] }],
        },
      }],
    })
    expect(settings).toContain('set-shell')
    expect(settings).toContain('Save')
    const calendar = ds.render({
      title: 'Calendar',
      presentation: 'page',
      components: [{
        type: 'calendar',
        props: { title: 'Calendar', days: ['Mon', 'Tue'], events: [{ title: 'Standup', when: 'Mon 9:00', duration: '15m' }] },
      }],
    })
    expect(calendar).toContain('cal-shell')
    expect(calendar).toContain('Standup')
  })

  it('renders a map work-stage, not a Primary/Details list', () => {
    const prev = process.env.GOOGLE_MAPS_API_KEY
    delete process.env.GOOGLE_MAPS_API_KEY
    try {
      const html = getDesignSystem('shadcn').render({
        title: 'Polygon generator',
        summary: 'Draw polygons',
        presentation: 'page',
        components: [{
          type: 'work-stage',
          props: {
            mode: 'map',
            title: 'Polygon generator',
            kicker: 'Map layer',
            subtitle: 'Draw on a demo map layer.',
            tools: ['select', 'polygon', 'delete'],
            layers: [{ name: 'Base map', kind: 'tiles', status: 'On' }],
          },
        }],
      })
      expect(html).toContain('work-shell')
      expect(html).toContain('data-mode="map"')
      expect(html).toContain('polygon')
      expect(html).toContain('class="work-page')
      expect(html).toContain('id="gmap"')
      expect(html).toContain('maps-gate')
      expect(html).toContain('Load Google Maps SDK')
      expect(html).toContain('loadMcpGoogleMaps')
      expect(html).not.toContain('class="map-svg"')
      expect(html).not.toMatch(/<script src="https:\/\/maps\.googleapis\.com/)
      expect(html).not.toContain('Primary')
      expect(html).not.toContain('<table')
    } finally {
      if (prev === undefined) delete process.env.GOOGLE_MAPS_API_KEY
      else process.env.GOOGLE_MAPS_API_KEY = prev
    }
  })

  it('loads Maps JavaScript API and Drawing library when a Maps key is present', () => {
    const spec = {
      title: 'Google Maps',
      presentation: 'page',
      components: [{
        type: 'work-stage',
        props: {
          mode: 'map',
          title: 'Google Maps',
          tools: ['select', 'polygon', 'delete'],
          layers: [{ name: 'Base map', kind: 'tiles' }],
        },
      }],
    }
    const key = 'AIzaSyTestKeyThatIsLongEnough12'
    const html = runWithGoogleMapsKey(key, () => getDesignSystem('shadcn').render(spec))
    expect(html).toContain('maps.googleapis.com/maps/api/js')
    expect(html).toContain('libraries=drawing')
    expect(html).toContain('callback=initMcpGoogleMap')
    expect(html).toContain('id="gmap"')
    expect(html).toContain('data-maps="google"')
    expect(html).toContain('Google Maps SDK')
    expect(html).toContain(encodeURIComponent(key))
    expect(html).not.toContain('class="map-svg"')
    expect(html).not.toContain('id="maps-gate"')
    expect(JSON.stringify(spec)).not.toContain(key)
  })

  it('switches the active design system', () => {
    setActiveDesignSystem('material')
    expect(getDesignSystem().id).toBe('material')
    setActiveDesignSystem('shadcn')
  })
})
