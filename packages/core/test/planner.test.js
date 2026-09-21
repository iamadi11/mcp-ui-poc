import { describe, it, expect } from 'vitest'
import { heuristicPlan, planUI, aiAvailable } from '../src/planner.js'
import { jevAvailable } from '../src/jev/planner.js'
import { extractPolicy } from '../src/layout-policy.js'
import { demoPayload } from '../src/demo-payload.js'

const designSystem = {
  id: 'test',
  name: 'Test',
  components: [
    { type: 'stat-grid', description: 'metrics' },
    { type: 'table', description: 'table' },
    { type: 'chart', description: 'chart' },
  ],
}

function jevAnswers({ confidence = 0.9, presentation = 'page' } = {}) {
  return {
    presentation: { choice: presentation, confidence },
    density: { score: 1, confidence },
    named_widget: { choice: 'none', confidence },
    chart_type: { choice: 'bar', confidence },
    include_stat_grid: { noul: 0.9 },
    include_table: { noul: 0.9 },
    include_chart: { noul: 0.85 },
    include_list: { noul: 0.05 },
    include_key_value: { noul: 0.05 },
    include_text: { noul: 0.05 },
    include_badge_row: { noul: 0.05 },
    include_alert: { noul: 0.05 },
    include_action_row: { noul: 0.05 },
    field_0: { noul: 0.9 },
    field_1: { noul: 0.9 },
    field_2: { noul: 0.9 },
  }
}

describe('heuristicPlan', () => {
  it('builds stat-grid + table + chart for an array of records', () => {
    const data = [
      { id: 1, name: 'Alice', score: 10 },
      { id: 2, name: 'Bob', score: 20 },
    ]
    const spec = heuristicPlan(data, 'https://example.com/records', '')
    expect(spec.presentation).toBe('page')
    expect(spec.components.map((c) => c.type)).toEqual(['stat-grid', 'table', 'chart'])
  })

  it('uses modal presentation when instructions ask for a popup', () => {
    const spec = heuristicPlan({ a: 1 }, 'https://example.com/obj', 'show in a popup')
    expect(spec.presentation).toBe('modal')
    expect(spec.components[0].type).toBe('key-value')
  })

  it('falls back to text for primitive data', () => {
    const spec = heuristicPlan('hello world', 'https://example.com/text', '')
    expect(spec.components[0]).toEqual({ type: 'text', props: { content: 'hello world' } })
  })

  it('skips nested object columns and honors field/chart instructions', () => {
    const data = [
      { id: 1, name: 'Alice', email: 'a@x.com', address: { city: 'Paris' }, score: 10 },
      { id: 2, name: 'Bob', email: 'b@x.com', address: { city: 'Lyon' }, score: 20 },
    ]
    const defaultSpec = heuristicPlan(data, 'https://example.com/users', '')
    expect(defaultSpec.components.find((c) => c.type === 'table').props.columns.map((c) => c.key))
      .toEqual(['id', 'name', 'email', 'score'])

    const named = heuristicPlan(data, 'https://example.com/users', 'just show name and email')
    expect(named.components.map((c) => c.type)).toEqual(['table'])
    expect(named.components[0].props.columns.map((c) => c.key)).toEqual(['name', 'email'])

    const chart = heuristicPlan(data, 'https://example.com/users', 'show as a bar chart')
    expect(chart.components.map((c) => c.type)).toEqual(['chart'])
    expect(chart.components[0].props.chartType).toBe('bar')
  })
})

describe('planUI', () => {
  it('falls back to heuristic plan when no LLM provider is configured', async () => {
    const data = { foo: 'bar' }
    const { spec, planner, policy } = await planUI({
      data,
      sourceUrl: 'https://example.com',
      instructions: '',
      designSystem,
      llmProvider: 'anthropic',
    })
    expect(planner).toBe('heuristic')
    expect(spec.components[0].type).toBe('key-value')
    expect(policy.componentTypes).toContain('key-value')
  })

  it('replays a cached layout policy only when fresh is explicitly false', async () => {
    const data = [
      { id: 1, name: 'Alice', score: 10 },
      { id: 2, name: 'Bob', score: 20 },
    ]
    const cachedPolicy = extractPolicy(
      heuristicPlan(data, 'https://example.com/records', ''),
      data,
    )
    let asked = 0
    const { spec, planner, cached } = await planUI({
      data,
      sourceUrl: 'https://example.com/records',
      instructions: '',
      designSystem,
      cachedPolicy,
      fresh: false,
      askJev: async () => {
        asked += 1
        throw new Error('should not be called')
      },
    })
    expect(planner).toBe('replay')
    expect(cached).toBe(true)
    expect(asked).toBe(0)
    expect(spec.components.map((c) => c.type)).toEqual(['stat-grid', 'chart', 'table'])
  })

  it('skips fingerprint replay when fresh is omitted even if cachedPolicy is set', async () => {
    const data = [
      { id: 1, name: 'Alice', score: 10 },
      { id: 2, name: 'Bob', score: 20 },
    ]
    const cachedPolicy = extractPolicy(
      heuristicPlan(data, 'https://example.com/records', ''),
      data,
    )
    let asked = 0
    const { planner, cached } = await planUI({
      data,
      sourceUrl: 'https://example.com/records',
      instructions: '',
      designSystem,
      cachedPolicy,
      askJev: async () => {
        asked += 1
        return { model: 'jev-1.13.0', answers: jevAnswers() }
      },
    })
    expect(asked).toBe(1)
    expect(planner).not.toBe('replay')
    expect(planner).toBe('jev:jev-1.13.0')
    expect(cached).toBe(false)
  })

  it('skips fingerprint replay when fresh is set so Jev can plan again', async () => {
    const data = [
      { id: 1, name: 'Alice', score: 10 },
      { id: 2, name: 'Bob', score: 20 },
    ]
    const cachedPolicy = extractPolicy(
      heuristicPlan(data, 'https://example.com/records', ''),
      data,
    )
    let asked = 0
    const { planner, cached } = await planUI({
      data,
      sourceUrl: 'https://example.com/records',
      instructions: '',
      designSystem,
      cachedPolicy,
      fresh: true,
      askJev: async () => {
        asked += 1
        return { model: 'jev-1.13.0', answers: jevAnswers() }
      },
    })
    expect(asked).toBe(1)
    expect(planner).toBe('jev:jev-1.13.0')
    expect(cached).toBe(false)
  })

  it('uses Jev answers to assemble a spec when confidence is high', async () => {
    const data = [
      { id: 1, name: 'Alice', score: 10 },
      { id: 2, name: 'Bob', score: 20 },
    ]
    const { spec, planner, jevConfidence } = await planUI({
      data,
      sourceUrl: 'https://example.com/records',
      instructions: 'show as a dashboard',
      designSystem,
      askJev: async () => ({ model: 'jev-1.13.0', answers: jevAnswers() }),
    })
    expect(planner).toBe('jev:jev-1.13.0')
    expect(jevConfidence).toBeGreaterThan(0.5)
    expect(spec.components.map((c) => c.type)).toEqual(['stat-grid', 'chart', 'table'])
  })

  it('keeps Jev when needs_llm is high but catalog widgets were selected', async () => {
    const { planner, jevConfidence } = await planUI({
      data: { foo: 'bar' },
      sourceUrl: 'https://example.com',
      instructions: 'dashboard with heavy animation',
      designSystem,
      llmProvider: 'anthropic',
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: { ...jevAnswers({ confidence: 0.9 }), needs_llm: { noul: 0.9 } },
      }),
    })
    expect(planner).toBe('jev:jev-1.13.0')
    expect(jevConfidence).toBeGreaterThan(0.5)
  })

  it('falls through when the catalog cannot express the ask', async () => {
    const { planner, jevConfidence } = await planUI({
      data: { foo: 'bar' },
      sourceUrl: 'https://example.com',
      instructions: 'write custom copy',
      designSystem,
      llmProvider: 'anthropic',
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: {
          named_widget: { choice: 'none', confidence: 0.9 },
          presentation: { choice: 'page', confidence: 0.9 },
          include_stat_grid: { noul: 0.05 },
          include_table: { noul: 0.05 },
          include_chart: { noul: 0.05 },
          needs_llm: { noul: 0.9 },
          in_catalog: { noul: 0.1 },
        },
      }),
    })
    expect(planner).toBe('heuristic')
    expect(jevConfidence).toBe(0.9)
  })

  it('falls through to heuristic when Jev confidence is low and no LLM is configured', async () => {
    const data = { foo: 'bar' }
    const { planner, spec, jevConfidence } = await planUI({
      data,
      sourceUrl: 'https://example.com',
      instructions: '',
      designSystem,
      llmProvider: 'anthropic',
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: {
          named_widget: { choice: 'none', confidence: 0.2 },
          presentation: { choice: 'page', confidence: 0.2 },
          in_catalog: { noul: 0.2 },
        },
      }),
    })
    expect(planner).toBe('heuristic')
    expect(jevConfidence).toBe(0.2)
    expect(spec.components[0].type).toBe('key-value')
  })

  it('uses Jev even when unused include_* confidence is low', async () => {
    const { planner, jevConfidence } = await planUI({
      data: [
        { id: 1, name: 'Alice', score: 10 },
        { id: 2, name: 'Bob', score: 20 },
      ],
      sourceUrl: 'https://example.com',
      instructions: 'Show as a bar chart',
      designSystem,
      llmProvider: 'anthropic',
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: {
          ...jevAnswers({ confidence: 0.85 }),
          named_widget: { choice: 'chart', confidence: 0.85 },
          surface: { choice: 'page', confidence: 0.8 },
          intent: { choice: 'create_widget', confidence: 0.28 },
          include_badge_row: { noul: 0.05, confidence: 0.11 },
          needs_llm: { noul: 0.7 },
        },
      }),
    })
    expect(planner).toBe('jev:jev-1.13.0')
    expect(jevConfidence).toBeGreaterThan(0.5)
  })

  it('runs Jev from a request TypeSafe key without TYPESAFE_API_KEY env', async () => {
    const prev = process.env.TYPESAFE_API_KEY
    delete process.env.TYPESAFE_API_KEY
    try {
      expect(jevAvailable()).toBe(false)
      expect(jevAvailable('ts_session')).toBe(true)
      const data = [
        { id: 1, name: 'Alice', score: 10 },
        { id: 2, name: 'Bob', score: 20 },
      ]
      const { planner } = await planUI({
        data,
        sourceUrl: 'https://example.com/records',
        instructions: '',
        designSystem,
        typesafeApiKey: 'ts_session',
        askJev: async () => ({ model: 'jev-1.13.0', answers: jevAnswers() }),
      })
      expect(planner).toBe('jev:jev-1.13.0')
    } finally {
      if (prev !== undefined) process.env.TYPESAFE_API_KEY = prev
      else delete process.env.TYPESAFE_API_KEY
    }
  })

  it('calls Jev for a login page and constructs login-form', async () => {
    let asked = 0
    const data = {
      store: 'Tata 1mg',
      channel: 'Sign in',
      notice: 'Sign in to Tata 1mg.',
      items: [
        { field: 'Email', type: 'email', required: 'Yes' },
        { field: 'Password', type: 'password', required: 'Yes' },
      ],
    }
    const { spec, planner, policy, trace } = await planUI({
      data,
      sourceUrl: 'demo:login',
      instructions: 'create a login page for Tata 1mg',
      designSystem,
      askJev: async () => {
        asked += 1
        return {
          model: 'jev-1.13.0',
          answers: {
            ...jevAnswers(),
            intent: { choice: 'create_widget', confidence: 0.9 },
            surface_kind: { choice: 'auth', confidence: 0.92 },
            named_widget: { choice: 'login-form', confidence: 0.93 },
            include_login_form: { noul: 0.95 },
            in_catalog: { noul: 0.9 },
          },
        }
      },
    })
    expect(asked).toBe(1)
    expect(planner).toBe('jev:jev-1.13.0')
    expect(policy.componentTypes).toEqual(['login-form'])
    expect(spec.components.map((c) => c.type)).toEqual(['login-form'])
    expect(spec.components[0].props.brand).toBe('Tata 1mg')
    expect(trace.path[0]).toBe('jev')
  })

  it('calls Jev for a polygon map workspace', async () => {
    let asked = 0
    const data = {
      surface: 'tool',
      mode: 'map',
      store: 'Polygon generator on google maps layer',
      channel: 'Workspace',
      tools: ['select', 'polygon', 'delete'],
      items: [
        { title: 'Base map', subtitle: 'tiles', meta: 'On' },
        { title: 'Polygons', subtitle: 'vector', meta: 'Editable' },
      ],
    }
    const { spec, planner, trace } = await planUI({
      data,
      sourceUrl: 'demo:workspace',
      instructions: 'create a polygon generator on google maps layer',
      designSystem,
      askJev: async () => {
        asked += 1
        return {
          model: 'jev-1.13.0',
          answers: {
            ...jevAnswers(),
            intent: { choice: 'create_widget', confidence: 0.9 },
            surface_kind: { choice: 'tool', confidence: 0.91 },
            tool_primitive: { choice: 'map', confidence: 0.9 },
            named_widget: { choice: 'work-stage', confidence: 0.92 },
            include_work_stage: { noul: 0.95 },
            in_catalog: { noul: 0.9 },
          },
        }
      },
    })
    expect(asked).toBe(1)
    expect(planner).toBe('jev:jev-1.13.0')
    expect(spec.components.map((c) => c.type)).toEqual(['work-stage'])
    expect(spec.components[0].props.mode).toBe('map')
    expect(trace.path[0]).toBe('jev')
  })

  it('calls Jev for a Google Maps polygon dashboard prompt', async () => {
    let asked = 0
    const prompt =
      'can you create me a dashboard using google maps and shadcn where user can create polygons on google map'
    const data = {
      surface: 'tool',
      mode: 'map',
      store: 'Google Maps',
      channel: 'Workspace',
      tools: ['select', 'polygon', 'delete'],
      items: [
        { title: 'Base map', subtitle: 'tiles', meta: 'On' },
        { title: 'Polygons', subtitle: 'vector', meta: 'Editable' },
      ],
    }
    const { spec, planner } = await planUI({
      data,
      sourceUrl: 'demo:workspace',
      instructions: prompt,
      designSystem,
      askJev: async () => {
        asked += 1
        return {
          model: 'jev-1.13.0',
          answers: {
            ...jevAnswers(),
            surface_kind: { choice: 'tool', confidence: 0.9 },
            tool_primitive: { choice: 'map', confidence: 0.9 },
            named_widget: { choice: 'work-stage', confidence: 0.9 },
            include_work_stage: { noul: 0.95 },
            in_catalog: { noul: 0.9 },
          },
        }
      },
    })
    expect(asked).toBe(1)
    expect(planner).toBe('jev:jev-1.13.0')
    expect(spec.components[0].props.mode).toBe('map')
    expect(spec.components[0].props.tools).toEqual(expect.arrayContaining(['polygon']))
  })

  it('still calls Jev when fresh is set on a map prompt', async () => {
    let asked = 0
    const prompt =
      'Create a google maps based polygon generator dashboard and user can create and save polygons on that.'
    const data = {
      surface: 'tool',
      mode: 'map',
      store: 'Google Maps',
      channel: 'Workspace',
      tools: ['select', 'polygon', 'delete'],
      items: [
        { title: 'Base map', subtitle: 'tiles', meta: 'On' },
        { title: 'Polygons', subtitle: 'vector', meta: 'Editable' },
      ],
    }
    const { spec, planner, cached } = await planUI({
      data,
      sourceUrl: 'demo:workspace',
      instructions: prompt,
      designSystem,
      fresh: true,
      askJev: async () => {
        asked += 1
        return {
          model: 'jev-1.13.0',
          answers: {
            ...jevAnswers(),
            surface_kind: { choice: 'tool', confidence: 0.9 },
            tool_primitive: { choice: 'map', confidence: 0.9 },
            named_widget: { choice: 'work-stage', confidence: 0.9 },
            include_work_stage: { noul: 0.95 },
            in_catalog: { noul: 0.9 },
          },
        }
      },
    })
    expect(asked).toBe(1)
    expect(planner).toBe('jev:jev-1.13.0')
    expect(cached).toBe(false)
    expect(spec.components[0].props.mode).toBe('map')
  })

  it('calls Jev for a Maps SDK follow-up with previousPolicy', async () => {
    let asked = 0
    const previousPolicy = {
      presentation: 'page',
      componentTypes: ['work-stage'],
      stageMode: 'map',
    }
    const { planner, spec } = await planUI({
      data: {
        surface: 'tool',
        mode: 'map',
        store: 'Google Maps',
        tools: ['select', 'polygon', 'delete'],
        items: [{ title: 'Base map', subtitle: 'tiles' }],
      },
      sourceUrl: 'demo:workspace',
      instructions: 'you haven\'t use google maps sdk',
      designSystem,
      previousPolicy,
      fresh: true,
      askJev: async () => {
        asked += 1
        return {
          model: 'jev-1.13.0',
          answers: {
            ...jevAnswers(),
            intent: { choice: 'iterate', confidence: 0.8 },
            surface_kind: { choice: 'tool', confidence: 0.9 },
            tool_primitive: { choice: 'map', confidence: 0.9 },
            named_widget: { choice: 'work-stage', confidence: 0.9 },
            include_work_stage: { noul: 0.95 },
            in_catalog: { noul: 0.9 },
          },
        }
      },
    })
    expect(asked).toBe(1)
    expect(planner).toBe('jev:jev-1.13.0')
    expect(spec.components[0].props.mode).toBe('map')
  })

  it('calls Jev to hide the table on an iterate turn', async () => {
    let asked = 0
    const data = [
      { id: 1, name: 'Alice', score: 10 },
      { id: 2, name: 'Bob', score: 20 },
    ]
    const previousPolicy = extractPolicy(
      heuristicPlan(data, 'https://example.com/records', ''),
      data,
    )
    const { spec, planner, policy } = await planUI({
      data,
      sourceUrl: 'https://example.com/records',
      instructions: 'hide the table',
      designSystem,
      previousPolicy,
      askJev: async () => {
        asked += 1
        return {
          model: 'jev-1.13.0',
          answers: {
            ...jevAnswers(),
            intent: { choice: 'iterate', confidence: 0.88 },
            surface_kind: { choice: 'records', confidence: 0.8 },
            named_widget: { choice: 'none', confidence: 0.7 },
            patch_hide_table: { noul: 0.95 },
            include_table: { noul: 0.05 },
            include_chart: { noul: 0.9 },
            in_catalog: { noul: 0.9 },
          },
        }
      },
    })
    expect(asked).toBe(1)
    expect(planner).toBe('jev:jev-1.13.0')
    expect(policy.componentTypes).not.toContain('table')
    expect(spec.components.map((c) => c.type)).not.toContain('table')
  })

  it('constructs a landing page from Jev answers', async () => {
    const data = {
      store: 'Stride',
      channel: 'Landing',
      items: [
        { block: 'Hero', copy: 'Run further.', cta: 'Shop' },
        { block: 'Proof', copy: '12k runners', cta: '' },
      ],
    }
    const { spec, planner } = await planUI({
      data,
      sourceUrl: 'demo:landing',
      instructions: 'Create a landing page for a shoes store',
      designSystem,
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: {
          ...jevAnswers(),
          surface_kind: { choice: 'marketing', confidence: 0.9 },
          named_widget: { choice: 'landing-page', confidence: 0.92 },
          include_landing_page: { noul: 0.95 },
          in_catalog: { noul: 0.9 },
        },
      }),
    })
    expect(planner).toBe('jev:jev-1.13.0')
    expect(spec.components.map((c) => c.type)).toEqual(['landing-page'])
    expect(spec.components[0].props.headline).toMatch(/Run further/i)
  })

  it('constructs checkout from Jev answers', async () => {
    const data = {
      store: 'Stride',
      channel: 'Checkout',
      items: [{ product: 'Aero Runner', qty: 1, price: 129 }],
      totals: { total: 129 },
    }
    const { spec, planner } = await planUI({
      data,
      sourceUrl: 'demo:checkout',
      instructions: 'Create a checkout for a shoes store',
      designSystem,
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: {
          ...jevAnswers(),
          surface_kind: { choice: 'commerce', confidence: 0.9 },
          named_widget: { choice: 'checkout', confidence: 0.92 },
          include_checkout: { noul: 0.95 },
          in_catalog: { noul: 0.9 },
        },
      }),
    })
    expect(planner).toBe('jev:jev-1.13.0')
    expect(spec.components.map((c) => c.type)).toEqual(['checkout'])
  })

  it('constructs a contact form instead of a workspace board', async () => {
    const data = {
      store: 'Studio',
      channel: 'Form',
      items: [
        { field: 'Name', type: 'text', required: 'Yes' },
        { field: 'Email', type: 'email', required: 'Yes' },
      ],
    }
    const { spec, planner } = await planUI({
      data,
      sourceUrl: 'demo:form',
      instructions: 'Create a contact form',
      designSystem,
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: {
          ...jevAnswers(),
          surface_kind: { choice: 'unknown', confidence: 0.7 },
          named_widget: { choice: 'form', confidence: 0.9 },
          include_form: { noul: 0.95 },
          in_catalog: { noul: 0.9 },
        },
      }),
    })
    expect(planner).toBe('jev:jev-1.13.0')
    expect(spec.components.map((c) => c.type)).toEqual(['form'])
  })

  it('falls back to catalog login when Jev is unavailable', async () => {
    const data = {
      store: 'Tata 1mg',
      channel: 'Sign in',
      items: [
        { field: 'Email', type: 'email', required: 'Yes' },
        { field: 'Password', type: 'password', required: 'Yes' },
      ],
    }
    const { spec, planner } = await planUI({
      data,
      sourceUrl: 'demo:login',
      instructions: 'create a login page for Tata 1mg',
      designSystem,
    })
    expect(planner).toBe('catalog')
    expect(spec.components.map((c) => c.type)).toEqual(['login-form'])
  })

  it('switches a login session to checkout when the prompt names checkout', async () => {
    const data = demoPayload('Create a checkout page for flipkart')
    const { spec, planner } = await planUI({
      data,
      sourceUrl: 'demo:login',
      instructions: 'Create a checkout page for flipkart',
      designSystem,
      previousPolicy: {
        presentation: 'page',
        motion: 'none',
        componentTypes: ['login-form'],
        title: 'Tata 1mg',
      },
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: {
          ...jevAnswers(),
          intent: { choice: 'iterate', confidence: 0.8 },
          named_widget: { choice: 'login-form', confidence: 0.9 },
          include_login_form: { noul: 0.95 },
          include_checkout: { noul: 0.2 },
          in_catalog: { noul: 0.9 },
        },
      }),
    })
    expect(planner).toBe('jev:jev-1.13.0')
    expect(spec.components.map((c) => c.type)).toEqual(['checkout'])
    expect(spec.components[0].props.brand).toMatch(/Flipkart/i)
  })

  it('asks Haiku to generate tic-tac-toe instead of a workspace board', async () => {
    const prompt = 'Create a game of tic tac toe with heavy animation.'
    const data = demoPayload(prompt)
    let generated = 0
    const { spec, planner, policy } = await planUI({
      data,
      sourceUrl: 'demo:generated',
      instructions: prompt,
      designSystem,
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: {
          ...jevAnswers({ confidence: 0.4 }),
          named_widget: { choice: 'work-stage', confidence: 0.4 },
          include_work_stage: { noul: 0.8 },
          in_catalog: { noul: 0.1 },
          needs_llm: { noul: 0.95 },
          needs_motion: { noul: 0.9 },
          motion: { choice: 'stagger', confidence: 0.8 },
        },
      }),
      generateUi: async () => {
        generated += 1
        return {
          title: 'Tic-tac-toe',
          html: '<div class="board" role="grid"><button type="button">play</button></div>',
          css: '.board{display:grid}@keyframes pop { from { transform: scale(0) } to { transform: scale(1) } }',
          script: 'document.querySelector(".board")',
        }
      },
    })
    expect(generated).toBe(1)
    expect(planner).toBe('haiku:generate')
    expect(spec.components.map((c) => c.type)).toEqual(['html-block'])
    expect(spec.components[0].props.html).toContain('board')
    expect(spec.motion).toBe('stagger')
    expect(policy.html).toContain('board')
    expect(JSON.stringify(spec)).not.toMatch(/Workspace generated/)
    expect(JSON.stringify(spec)).not.toMatch(/work-stage/)
  })

  it('generates a Snitch checkout instead of replaying the Stride catalog cart', async () => {
    const prompt = 'Can you create checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.'
    const data = demoPayload(prompt)
    const leftover = {
      presentation: 'page',
      componentTypes: ['checkout'],
      title: 'Stride',
    }
    let generated = 0
    const { spec, planner, cached } = await planUI({
      data,
      sourceUrl: 'demo:generated',
      instructions: prompt,
      designSystem,
      previousPolicy: leftover,
      cachedPolicy: leftover,
      fresh: true,
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: {
          ...jevAnswers({ confidence: 0.9 }),
          named_widget: { choice: 'checkout', confidence: 0.95 },
          include_checkout: { noul: 0.95 },
          in_catalog: { noul: 0.9 },
        },
      }),
      generateUi: async () => {
        generated += 1
        return {
          title: 'Snitch',
          kicker: 'Clothing checkout',
          html: '<div class="snitch-cart">hoodie</div>',
          css: '@keyframes spray { from { opacity: 0 } to { opacity: 1 } } .snitch-cart { animation: spray 700ms ease both }',
          script: 'document.querySelector(".snitch-cart")',
        }
      },
    })
    expect(generated).toBe(1)
    expect(planner).toBe('haiku:generate')
    expect(planner).not.toBe('replay')
    expect(cached).toBe(false)
    expect(spec.components.map((c) => c.type)).toEqual(['html-block'])
    expect(spec.components[0].props.html).toContain('snitch-cart')
    expect(spec.components[0].props.css).toMatch(/@keyframes|animation:/)
    expect(JSON.stringify(spec)).not.toMatch(/Aero Runner/)
    expect(JSON.stringify(spec)).not.toMatch(/"checkout"/)
  })

  it('injects paint CSS when Snitch graffiti generate returns a static wordmark', async () => {
    const prompt = 'Can you create checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.'
    const data = demoPayload(prompt)
    const { spec, planner } = await planUI({
      data,
      sourceUrl: 'demo:generated',
      instructions: prompt,
      designSystem,
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: {
          ...jevAnswers({ confidence: 0.9 }),
          named_widget: { choice: 'checkout', confidence: 0.95 },
          include_checkout: { noul: 0.95 },
          in_catalog: { noul: 0.9 },
        },
      }),
      generateUi: async () => ({
        title: 'SNITCH',
        kicker: 'Wordmark',
        html: '<h1 class="wordmark">SNITCH</h1>',
        css: '.wordmark{letter-spacing:.2em}',
      }),
    })
    expect(planner).toBe('haiku:generate')
    expect(spec.components.map((c) => c.type)).toEqual(['html-block'])
    expect(spec.components[0].props.html).toContain('wordmark')
    expect(spec.components[0].props.css).toMatch(/@keyframes/)
    expect(spec.components[0].props.css).toMatch(/animation:/)
  })

  it('plans the same create prompt live twice when fresh is set', async () => {
    const prompt = 'Can you create checkout for Snitch with graffiti on load'
    const data = demoPayload(prompt)
    const leftover = {
      presentation: 'page',
      componentTypes: ['checkout'],
      title: 'Stride',
    }
    const run = () => planUI({
      data,
      sourceUrl: 'demo:generated',
      instructions: prompt,
      designSystem,
      cachedPolicy: leftover,
      fresh: true,
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: {
          ...jevAnswers({ confidence: 0.9 }),
          named_widget: { choice: 'checkout', confidence: 0.95 },
          include_checkout: { noul: 0.95 },
          in_catalog: { noul: 0.9 },
        },
      }),
      generateUi: async () => ({
        title: 'Snitch checkout',
        html: '<div class="snitch-cart">hoodie</div>',
        css: '@keyframes spray { to { opacity: 1 } }',
      }),
    })
    const first = await run()
    const second = await run()
    expect(first.planner).not.toBe('replay')
    expect(second.planner).not.toBe('replay')
    expect(first.planner).toBe('haiku:generate')
    expect(second.planner).toBe('haiku:generate')
  })

  it('does not ask for an Anthropic key when Haiku fails and a key is present', async () => {
    const prompt = 'Create a game of tic tac toe with heavy animation.'
    const data = demoPayload(prompt)
    const { spec, planner } = await planUI({
      data,
      sourceUrl: 'demo:generated',
      instructions: prompt,
      designSystem,
      apiKey: 'sk-test',
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: {
          ...jevAnswers({ confidence: 0.4 }),
          named_widget: { choice: 'work-stage', confidence: 0.4 },
          include_work_stage: { noul: 0.8 },
          in_catalog: { noul: 0.1 },
          needs_llm: { noul: 0.95 },
        },
      }),
      generateUi: async () => {
        throw new Error('401 authentication')
      },
    })
    expect(planner).toBe('generate:missing')
    expect(spec.components[0].props.message).not.toMatch(/Add an Anthropic key/i)
    expect(spec.components[0].props.message).toMatch(/API key|generate/i)
  })
})

describe('jevAvailable', () => {
  it('is true for a request key or env, false when neither is set', () => {
    const prev = process.env.TYPESAFE_API_KEY
    delete process.env.TYPESAFE_API_KEY
    try {
      expect(jevAvailable()).toBe(false)
      expect(jevAvailable('')).toBe(false)
      expect(jevAvailable('ts_session')).toBe(true)
      process.env.TYPESAFE_API_KEY = 'ts_env'
      expect(jevAvailable()).toBe(true)
    } finally {
      if (prev !== undefined) process.env.TYPESAFE_API_KEY = prev
      else delete process.env.TYPESAFE_API_KEY
    }
  })
})

describe('aiAvailable', () => {
  it('returns false for an unconfigured provider', () => {
    expect(aiAvailable('anthropic')).toBe(false)
  })
})
