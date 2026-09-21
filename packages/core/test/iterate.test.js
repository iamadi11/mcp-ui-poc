import { describe, it, expect } from 'vitest'
import {
  isIteratePrompt,
  applyInstructionUpgrades,
  mergeIteratePolicy,
  selectReplayPolicy,
  planUI,
  applyPolicy,
  getDesignSystem,
  demoPayload,
} from '../src/index.js'

const previous = {
  presentation: 'page',
  motion: 'none',
  title: 'Temperature',
  summary: 'Live data · api.open-meteo.com',
  componentTypes: ['stat-grid', 'chart', 'table'],
  includedFields: ['time', 'temperature_2m'],
  rowsPath: 'hourly',
  columns: [
    { key: 'time', label: 'time' },
    { key: 'temperature_2m', label: 'temperature_2m' },
  ],
  chart: { chartType: 'line', valueKey: 'temperature_2m', labelKey: 'time' },
}

const weather = {
  hourly: {
    time: ['2026-09-18T00:00', '2026-09-18T01:00', '2026-09-18T02:00'],
    temperature_2m: [25.4, 25, 25.9],
  },
}

describe('isIteratePrompt', () => {
  it('treats add/change/tooltip follow-ups as iterates, not new dashboards', () => {
    expect(isIteratePrompt('add tooltip on temperature graph')).toBe(true)
    expect(isIteratePrompt('make it a bar chart')).toBe(true)
    expect(isIteratePrompt('hide the table')).toBe(true)
    expect(isIteratePrompt('there is nothing visible in records')).toBe(true)
    expect(isIteratePrompt('Create a dashboard from this API with heavy animations')).toBe(false)
    expect(isIteratePrompt('Create a dashboard from this API with tooltip and animation')).toBe(false)
    expect(isIteratePrompt('Create a game of tic tac toe with heavy animation')).toBe(false)
    expect(isIteratePrompt('Can you create checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.')).toBe(false)
    expect(isIteratePrompt('Can you create checkout for Snitch with graffiti on load')).toBe(false)
    expect(isIteratePrompt('graffiti is not coming')).toBe(true)
    expect(isIteratePrompt('graffiti is not visible')).toBe(true)
    expect(isIteratePrompt('Build a playable chess board with motion')).toBe(false)
    expect(isIteratePrompt('Can you create checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.')).toBe(false)
    expect(isIteratePrompt('graffiti is not coming')).toBe(true)
    expect(isIteratePrompt('Add records and create a dashboard.')).toBe(false)
    expect(isIteratePrompt('Show as a table')).toBe(false)
    expect(isIteratePrompt('Add animations on the dashboard.')).toBe(true)
    expect(isIteratePrompt('make the UI responsive')).toBe(true)
    expect(isIteratePrompt('add tooltip and drawer for more insights.')).toBe(true)
    expect(isIteratePrompt('give the ui a modern design and color full look')).toBe(true)
    expect(isIteratePrompt('make the design more colourful')).toBe(true)
  })
})

describe('applyInstructionUpgrades', () => {
  it('adds chart tooltips without dropping the current layout', () => {
    const next = applyInstructionUpgrades(previous, 'add tooltip on temperature graph')
    expect(next.chart.tooltip).toBe(true)
    expect(next.chart.chartType).toBe('line')
    expect(next.componentTypes).toEqual(['stat-grid', 'chart', 'table'])
  })

  it('puts the records table and chart back when the user says they are missing', () => {
    const statsOnly = { ...previous, componentTypes: ['stat-grid'] }
    const next = applyInstructionUpgrades(statsOnly, 'there is nothing visible in records')
    expect(next.componentTypes).toEqual(['stat-grid', 'chart', 'table'])
    const dashboard = applyInstructionUpgrades(statsOnly, 'Add records and create a dashboard.')
    expect(dashboard.componentTypes).toContain('table')
    expect(dashboard.componentTypes).toContain('chart')
  })

  it('turns on stagger motion when the user asks for animations', () => {
    const next = applyInstructionUpgrades(previous, 'Add animations on the dashboard.')
    expect(next.motion).toBe('stagger')
  })

  it('adds a details drawer when the user asks for insights or a responsive layout', () => {
    const next = applyInstructionUpgrades(previous, 'add tooltip and drawer for more insights.')
    expect(next.drawer).toBe(true)
    expect(next.chart.tooltip).toBe(true)
    const responsive = applyInstructionUpgrades(previous, 'make the UI responsive')
    expect(responsive.drawer).toBe(true)
  })

  it('keeps the layout and marks a vivid look for modern/color follow-ups', () => {
    const next = applyInstructionUpgrades(previous, 'give the ui a modern design and color full look')
    expect(next.look).toBe('vivid')
    expect(next.motion).toBe('stagger')
    expect(next.componentTypes).toEqual(['stat-grid', 'chart', 'table'])
  })

  it('sets radius for rounder corners without flipping vivid', () => {
    const landing = { presentation: 'page', motion: 'none', componentTypes: ['landing-page'] }
    const next = applyInstructionUpgrades(landing, 'rounder corners')
    expect(next.radius).toBe('16px')
    expect(next.look).not.toBe('vivid')
    expect(next.componentTypes).toEqual(['landing-page'])
    const lookChip = applyInstructionUpgrades(landing, 'use a rounder look')
    expect(lookChip.radius).toBe('16px')
    expect(lookChip.look).not.toBe('vivid')
    const merged = mergeIteratePolicy(landing, { ...landing, look: 'vivid' }, 'rounder corners')
    expect(merged.radius).toBe('16px')
    expect(merged.look).not.toBe('vivid')
    expect(isIteratePrompt('rounder corners')).toBe(true)
    expect(isIteratePrompt('Create a checkout page for flipkart')).toBe(false)
    expect(isIteratePrompt('Make it more animation heavy')).toBe(true)
    const checkout = { presentation: 'page', motion: 'none', componentTypes: ['checkout'], title: 'Flipkart' }
    const vivid = applyInstructionUpgrades(checkout, 'make it vivid and animation heavy')
    expect(vivid.look).toBe('vivid')
    expect(vivid.motion).toBe('stagger')
    expect(vivid.componentTypes).toEqual(['checkout'])
    expect(vivid.drawer).toBeFalsy()
  })
})

describe('selectReplayPolicy', () => {
  it('does not replay a neighbor/fingerprint layout over an iterate prompt', () => {
    expect(selectReplayPolicy({ fingerprintPolicy: previous, iterate: true })).toBeNull()
    expect(selectReplayPolicy({ fingerprintPolicy: previous, iterate: false })).toBeNull()
    expect(selectReplayPolicy({ fingerprintPolicy: previous, iterate: false, fresh: true })).toBeNull()
    expect(selectReplayPolicy({ fingerprintPolicy: previous, iterate: false, fresh: false })).toBe(previous)
  })

  it('never replays a leftover cart when the same create prompt is asked fresh', () => {
    const snitch = {
      presentation: 'page',
      componentTypes: ['checkout'],
      title: 'Stride',
    }
    const prompt = 'Can you create checkout for Snitch with graffiti on load'
    expect(
      selectReplayPolicy({
        fingerprintPolicy: snitch,
        iterate: isIteratePrompt(prompt),
        instructions: prompt,
        fresh: true,
      }),
    ).toBeNull()
  })

  it('does not replay a stats-only widget when the prompt asks for a dashboard', () => {
    const statsOnly = { ...previous, componentTypes: ['stat-grid'] }
    expect(
      selectReplayPolicy({
        fingerprintPolicy: statsOnly,
        iterate: false,
        instructions: 'Create a dashboard from this API with tooltip and animation',
      }),
    ).toBeNull()
    expect(
      selectReplayPolicy({
        fingerprintPolicy: previous,
        iterate: false,
        instructions: 'Create a dashboard from this API with tooltip and animation',
        fresh: false,
      }),
    ).toBe(previous)
  })

  it('does not replay a layout whose columns belong to a different API', () => {
    const postsPolicy = {
      ...previous,
      title: 'jsonplaceholder.typicode.com',
      rowsPath: '',
      includedFields: ['userId', 'id', 'title', 'body'],
      columns: [
        { key: 'userId', label: 'userId' },
        { key: 'id', label: 'id' },
        { key: 'title', label: 'title' },
        { key: 'body', label: 'body' },
      ],
    }
    const weatherShape = {
      rowsPath: 'hourly',
      fields: [
        { key: 'time', type: 'string' },
        { key: 'temperature_2m', type: 'number' },
      ],
    }
    expect(
      selectReplayPolicy({
        fingerprintPolicy: postsPolicy,
        iterate: false,
        instructions: 'Create a dashboard from this API with tooltip and animation',
        shape: weatherShape,
      }),
    ).toBeNull()
    expect(
      selectReplayPolicy({
        fingerprintPolicy: previous,
        iterate: false,
        instructions: 'Create a dashboard from this API with tooltip and animation',
        shape: weatherShape,
        fresh: false,
      }),
    ).toBe(previous)
  })
})

describe('planUI iterate', () => {
  it('keeps the current widget and turns on tooltips for a follow-up prompt', async () => {
    let asked = 0
    const { spec, policy, planner } = await planUI({
      data: weather,
      sourceUrl: 'https://api.open-meteo.com/forecast',
      instructions: 'add tooltip on temperature graph',
      designSystem: getDesignSystem('shadcn'),
      previousPolicy: previous,
      cachedPolicy: previous,
      askJev: async () => {
        asked += 1
        return {
          model: 'jev-1.13.0',
          answers: {
            intent: { choice: 'iterate', confidence: 0.9 },
            surface_kind: { choice: 'records', confidence: 0.85 },
            named_widget: { choice: 'none', confidence: 0.7 },
            patch_tooltip: { noul: 0.95 },
            include_chart: { noul: 0.9 },
            include_table: { noul: 0.9 },
            include_stat_grid: { noul: 0.9 },
            in_catalog: { noul: 0.9 },
          },
        }
      },
    })
    expect(asked).toBe(1)
    expect(planner).toBe('jev:jev-1.13.0')
    expect(policy.chart.tooltip).toBe(true)
    expect(policy.chart.valueKey).toBe('temperature_2m')
    expect(spec.components.find((c) => c.type === 'chart').props.tooltip).toBe(true)
    expect(spec.components.map((c) => c.type)).toEqual(['stat-grid', 'chart', 'table'])
    expect(spec.summary).toBe('Live data · api.open-meteo.com')
  })

  it('upgrades a demo checkout instead of dropping to an empty API prompt', async () => {
    const data = demoPayload('create a dashboard for ecommerce checkout app for shoes')
    const previousCheckout = {
      presentation: 'page',
      motion: 'none',
      title: 'Stride checkout',
      summary: 'Demo cart — attach an orders API to hydrate live checkouts.',
      componentTypes: ['stat-grid', 'chart', 'table'],
      includedFields: ['product', 'color', 'size', 'qty', 'price'],
      rowsPath: 'items',
      columns: [
        { key: 'product', label: 'Product' },
        { key: 'price', label: 'Price' },
      ],
      chart: { chartType: 'bar', valueKey: 'price', labelKey: 'product' },
    }
    const { spec, planner } = await planUI({
      data,
      sourceUrl: 'demo:checkout',
      instructions: 'give the ui a modern design and color full look',
      designSystem: getDesignSystem('shadcn'),
      previousPolicy: previousCheckout,
      askJev: async () => {
        throw new Error('visual iterate must not call Jev')
      },
    })
    expect(planner).toBe('iterate')
    expect(spec.look).toBe('vivid')
    expect(spec.title.toLowerCase()).toMatch(/checkout/)
    expect(JSON.stringify(spec)).not.toMatch(/Add an API/)
    expect(JSON.stringify(spec)).not.toMatch(/No API attached/)
    const html = getDesignSystem('shadcn').render(spec)
    expect(html).toMatch(/data-look="vivid"/)
    expect(html).toContain('Aero Runner')
  })

  it('does not treat a same-shape neighbor as the session widget on a new chat', async () => {
    let asked = 0
    const { planner } = await planUI({
      data: weather,
      sourceUrl: 'https://api.open-meteo.com/forecast',
      instructions: 'please add a tooltip onto this temperature series now',
      designSystem: getDesignSystem('shadcn'),
      previousPolicy: null,
      neighbors: [{ policy: previous, replayEligible: true }],
      askJev: async () => {
        asked += 1
        return {
          model: 'jev-1.13.0',
          answers: {
            named_widget: { choice: 'chart', confidence: 0.9 },
            presentation: { choice: 'page', confidence: 0.9 },
            include_chart: { noul: 0.9 },
            in_catalog: { noul: 0.9 },
          },
        }
      },
    })
    expect(asked).toBe(1)
    expect(planner).not.toBe('iterate')
    expect(planner).toMatch(/^jev:/)
  })

  it('rebuilds a full dashboard instead of iterating a stats-only widget', async () => {
    const statsOnly = { ...previous, componentTypes: ['stat-grid'] }
    let asked = 0
    const { spec, planner } = await planUI({
      data: weather,
      sourceUrl: 'https://api.open-meteo.com/forecast',
      instructions: 'Add records and create a dashboard.',
      designSystem: getDesignSystem('shadcn'),
      previousPolicy: statsOnly,
      askJev: async () => {
        asked += 1
        return {
          model: 'jev-1.13.0',
          answers: {
            named_widget: { choice: 'none', confidence: 0.9 },
            presentation: { choice: 'page', confidence: 0.9 },
            include_stat_grid: { noul: 0.9 },
            include_table: { noul: 0.2 },
            include_chart: { noul: 0.2 },
            in_catalog: { noul: 0.9 },
          },
        }
      },
    })
    expect(asked).toBe(1)
    expect(planner).not.toBe('iterate')
    expect(spec.components.map((c) => c.type)).toEqual(expect.arrayContaining(['stat-grid', 'chart', 'table']))
    expect(spec.components.find((c) => c.type === 'table').props.rows.length).toBeGreaterThan(0)
  })

  it('restores the records table when the user says nothing is visible', async () => {
    const statsOnly = { ...previous, componentTypes: ['stat-grid'] }
    const { spec, planner } = await planUI({
      data: weather,
      sourceUrl: 'https://api.open-meteo.com/forecast',
      instructions: 'there is nothing visible in records',
      designSystem: getDesignSystem('shadcn'),
      previousPolicy: statsOnly,
      askJev: async () => {
        throw new Error('missing-records complaints are code upgrades')
      },
    })
    expect(planner).toBe('iterate')
    expect(spec.components.map((c) => c.type)).toEqual(['stat-grid', 'chart', 'table'])
    expect(spec.components.find((c) => c.type === 'table').props.rows).toHaveLength(3)
  })

  it('applies stagger motion for an animation follow-up', async () => {
    const { spec, policy, planner } = await planUI({
      data: weather,
      sourceUrl: 'https://api.open-meteo.com/forecast',
      instructions: 'Add animations on the dashboard.',
      designSystem: getDesignSystem('shadcn'),
      previousPolicy: previous,
      askJev: async () => {
        throw new Error('animation follow-ups are code upgrades')
      },
    })
    expect(planner).toBe('iterate')
    expect(policy.motion).toBe('stagger')
    expect(spec.motion).toBe('stagger')
    const html = getDesignSystem('shadcn').render(spec)
    expect(html).toMatch(/<body[^>]*data-motion="stagger"/)
    expect(html).toContain('mcp-enter')
  })

  it('opens a details drawer for tooltip and insights follow-ups', async () => {
    const users = [
      { id: 1, name: 'Leanne', email: 'a@x.com', address: { city: 'Gwenborough' } },
    ]
    const usersPolicy = {
      presentation: 'page',
      motion: 'none',
      title: 'Users',
      componentTypes: ['stat-grid', 'table', 'key-value'],
      includedFields: ['id', 'name', 'email'],
      rowsPath: '',
      columns: [
        { key: 'id', label: 'Id' },
        { key: 'name', label: 'Name' },
        { key: 'email', label: 'Email' },
      ],
    }
    const { spec, planner } = await planUI({
      data: users,
      sourceUrl: 'https://jsonplaceholder.typicode.com/users',
      instructions: 'add tooltip and drawer for more insights.',
      designSystem: getDesignSystem('shadcn'),
      previousPolicy: usersPolicy,
      askJev: async () => {
        throw new Error('drawer follow-ups are code upgrades')
      },
    })
    expect(planner).toBe('iterate')
    expect(spec.drawer).toBe(true)
    const html = getDesignSystem('shadcn').render(spec)
    expect(html).toMatch(/<body[^>]*data-drawer/)
    expect(html).toContain('insights-drawer')
    expect(html).toMatch(/@media \(max-width: 720px\)/)
  })

  it('does not iterate a leftover Stride widget when the user creates a new Snitch checkout', async () => {
    const prompt = 'Can you create checkout for Snitch with graffiti on load'
    const leftover = {
      presentation: 'page',
      motion: 'none',
      title: 'Stride',
      componentTypes: ['checkout'],
      html: '<div class="stride">Aero Runner</div>',
    }
    let generated = 0
    const { spec, planner } = await planUI({
      data: demoPayload(prompt),
      sourceUrl: 'demo:checkout',
      instructions: prompt,
      designSystem: getDesignSystem('shadcn'),
      previousPolicy: leftover,
      cachedPolicy: leftover,
      fresh: true,
      askJev: async () => {
        throw new Error('create must not reuse leftover via Jev in this test')
      },
      generateUi: async () => {
        generated += 1
        return {
          title: 'Snitch checkout',
          kicker: 'Clothing',
          html: '<div class="snitch-cart">hoodie</div>',
          css: '@keyframes graffiti-load { from { opacity: 0 } to { opacity: 1 } }',
        }
      },
    })
    expect(isIteratePrompt(prompt)).toBe(false)
    expect(generated).toBe(1)
    expect(planner).toBe('haiku:generate')
    expect(planner).not.toBe('iterate')
    expect(spec.components.map((c) => c.type)).toEqual(['html-block'])
    expect(JSON.stringify(spec)).toMatch(/snitch/i)
    expect(JSON.stringify(spec)).not.toMatch(/Aero Runner/)
  })
})

describe('ThemeAdapter tooltips', () => {
  it('renders hover targets on charts', () => {
    const html = getDesignSystem('shadcn').render({
      title: 'Temperature',
      presentation: 'page',
      components: [
        {
          type: 'chart',
          title: 'Temperature',
          props: {
            chartType: 'line',
            tooltip: true,
            values: [25.4, 31.6],
            labels: ['Sep 18, 12 AM', 'Sep 18, 7 AM'],
          },
        },
      ],
    })
    expect(html).toContain('chart-tooltip')
    expect(html).toContain('data-chart')
  })
})

describe('applyPolicy tooltip default', () => {
  it('hydrates tooltip onto line charts', () => {
    const spec = applyPolicy(previous, weather, 'https://api.open-meteo.com/forecast')
    const chart = spec.components.find((c) => c.type === 'chart')
    expect(chart.props.tooltip).toBe(true)
  })
})
