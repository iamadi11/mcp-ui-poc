import { describe, it, expect } from 'vitest'
import { heuristicPlan, planUI, aiAvailable } from '../src/planner.js'
import { jevAvailable } from '../src/jev/planner.js'
import { extractPolicy } from '../src/layout-policy.js'

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

  it('replays a cached layout policy without calling Jev', async () => {
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
