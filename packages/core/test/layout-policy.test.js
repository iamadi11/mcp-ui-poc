import { describe, it, expect } from 'vitest'
import { heuristicPlan } from '../src/planner.js'
import { applyPolicy, extractPolicy } from '../src/layout-policy.js'

const records = [
  { id: 1, name: 'Alice', score: 10 },
  { id: 2, name: 'Bob', score: 20 },
]

describe('layout policy', () => {
  it('round-trips a heuristic array layout through extract + apply', () => {
    const spec = heuristicPlan(records, 'https://example.com/records', '')
    const policy = extractPolicy(spec, records)
    expect(policy.componentTypes).toEqual(['stat-grid', 'table', 'chart'])
    expect(policy.chart.chartType).toBe('bar')
    expect(policy.chart.valueKey).toBe('score')
    expect(policy.chart.labelKey).toBe('name')
    expect(policy.columns.map((c) => c.key)).toEqual(['id', 'name', 'score'])

    const applied = applyPolicy(policy, records, 'https://example.com/records')
    expect(applied.presentation).toBe('page')
    expect(applied.components.map((c) => c.type)).toEqual(['stat-grid', 'chart', 'table'])
    const table = applied.components.find((c) => c.type === 'table')
    expect(table.props.columns.map((c) => c.key)).toEqual(['id', 'name', 'score'])
    expect(table.props.rows).toHaveLength(2)
    const chart = applied.components.find((c) => c.type === 'chart')
    expect(chart.props.chartType).toBe('bar')
    expect(chart.props.values).toEqual([10, 20])
    expect(chart.props.labels).toEqual(['Alice', 'Bob'])
  })

  it('hydrates Open-Meteo hourly series into table and chart values', () => {
    const weather = {
      latitude: 28.6,
      hourly: {
        time: ['00:00', '01:00', '02:00'],
        temperature_2m: [18.2, 17.4, 16.9],
      },
    }
    const spec = heuristicPlan(weather, 'https://api.open-meteo.com/forecast', 'dashboard')
    expect(spec.components.find((c) => c.type === 'table').props.rows).toHaveLength(3)
    const chart = spec.components.find((c) => c.type === 'chart')
    expect(chart.props.values).toEqual([18.2, 17.4, 16.9])
    const policy = extractPolicy(spec, weather)
    const applied = applyPolicy(policy, weather, 'https://api.open-meteo.com/forecast')
    expect(applied.components.find((c) => c.type === 'table').props.rows[0].temperature_2m).toBe(18.2)
  })

  it('downsamples a long hourly series and never dumps raw JSON as text', () => {
    const hours = Array.from({ length: 48 }, (_, i) => ({
      time: `2026-09-18T${String(i % 24).padStart(2, '0')}:00`,
      temperature_2m: 20 + i * 0.1,
    }))
    const weather = { hourly: { time: hours.map((h) => h.time), temperature_2m: hours.map((h) => h.temperature_2m) } }
    const spec = heuristicPlan(weather, 'https://api.open-meteo.com/forecast', 'dashboard')
    const policy = extractPolicy(spec, weather)
    const applied = applyPolicy(
      {
        ...policy,
        componentTypes: ['stat-grid', 'chart', 'text'],
        chart: { chartType: 'bar', valueKey: 'temperature_2m', labelKey: 'time' },
      },
      weather,
      'https://api.open-meteo.com/forecast',
    )
    const chart = applied.components.find((c) => c.type === 'chart')
    expect(chart.props.chartType).toBe('line')
    expect(chart.props.values.length).toBeLessThanOrEqual(24)
    expect(chart.props.labels[0]).not.toMatch(/T00:00$/)
    const stats = applied.components.find((c) => c.type === 'stat-grid')
    expect(stats.props.items.some((item) => item.label === 'High')).toBe(true)
    const text = applied.components.find((c) => c.type === 'text')
    expect(text.props.content).not.toContain('latitude')
    expect(text.props.content).not.toMatch(/^\{/)
  })

  it('replays the same policy onto new values', () => {
    const spec = heuristicPlan(records, 'https://example.com/records', '')
    const policy = extractPolicy(spec, records)
    const next = [
      { id: 9, name: 'Zed', score: 3 },
      { id: 10, name: 'Yen', score: 7 },
    ]
    const applied = applyPolicy(policy, next, 'https://example.com/records')
    const chart = applied.components.find((c) => c.type === 'chart')
    expect(chart.props.values).toEqual([3, 7])
    expect(chart.props.labels).toEqual(['Zed', 'Yen'])
  })

  it('drops nested JSON columns and humanizes headers', () => {
    const users = [
      {
        id: 1,
        name: 'Leanne Graham',
        email: 'leanne@april.biz',
        address: { city: 'Gwenborough', zipcode: '92998-3874' },
        company: { name: 'Romaguera-Crona' },
      },
    ]
    const applied = applyPolicy(
      {
        presentation: 'page',
        componentTypes: ['stat-grid', 'table', 'key-value'],
        includedFields: ['id', 'name', 'email', 'address', 'company'],
        columns: [
          { key: 'id', label: 'id' },
          { key: 'name', label: 'name' },
          { key: 'email', label: 'email' },
          { key: 'address', label: 'address' },
          { key: 'company', label: 'company' },
        ],
      },
      users,
      'https://jsonplaceholder.typicode.com/users',
    )
    const table = applied.components.find((c) => c.type === 'table')
    expect(table.props.columns.map((c) => c.key)).toEqual(['id', 'name', 'email'])
    expect(table.props.columns.map((c) => c.label)).toEqual(['Id', 'Name', 'Email'])
    const kv = applied.components.find((c) => c.type === 'key-value')
    expect(kv.props.pairs.map((p) => p.key)).toEqual(['id', 'name', 'email'])
    expect(kv.props.pairs.map((p) => String(p.value)).join(' ')).not.toContain('Gwenborough')
  })

  it('does not chart identifier fields like userId', () => {
    const posts = [
      { userId: 1, id: 1, title: 'Hello', body: 'World' },
      { userId: 1, id: 2, title: 'Next', body: 'Post' },
    ]
    const spec = heuristicPlan(posts, 'https://example.com/posts', 'dashboard')
    expect(spec.components.map((c) => c.type)).toEqual(['stat-grid', 'table'])
    const stats = spec.components.find((c) => c.type === 'stat-grid')
    expect(stats.props.items.some((item) => /userId/i.test(item.label))).toBe(false)
    const applied = applyPolicy(
      {
        presentation: 'page',
        componentTypes: ['stat-grid', 'table', 'chart'],
        chart: { chartType: 'bar', valueKey: 'userId', labelKey: 'title' },
      },
      posts,
      'https://example.com/posts',
    )
    expect(applied.components.map((c) => c.type)).toEqual(['stat-grid', 'table'])
  })

  it('hydrates demo login data as a login-form, not stats and a table', () => {
    const data = {
      store: 'Tata 1mg',
      channel: 'Sign in',
      notice: 'Sign in to Tata 1mg.',
      items: [
        { field: 'Email', type: 'email', required: 'Yes' },
        { field: 'Password', type: 'password', required: 'Yes' },
      ],
    }
    const spec = applyPolicy(
      { presentation: 'page', componentTypes: ['login-form'] },
      data,
      'demo:login',
    )
    expect(spec.components.map((c) => c.type)).toEqual(['login-form'])
    expect(spec.components[0].props.brand).toBe('Tata 1mg')
    expect(spec.components[0].props.fields.map((f) => f.type)).toEqual(['email', 'password'])
  })

  it('surfaces truncation flags when tables and charts sample large arrays', () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      score: i * 2,
    }))
    const applied = applyPolicy(
      {
        componentTypes: ['table', 'chart'],
        columns: [
          { key: 'id', label: 'Id' },
          { key: 'name', label: 'Name' },
          { key: 'score', label: 'Score' },
        ],
        chart: { chartType: 'bar', valueKey: 'score', labelKey: 'name' },
        includeKeys: ['id', 'name', 'score'],
      },
      rows,
      'https://example.com/records',
    )
    const table = applied.components.find((c) => c.type === 'table')
    expect(table.props.truncated).toBe(true)
    expect(table.props.total).toBe(60)
    expect(table.props.rows.length).toBeLessThanOrEqual(24)

    const chart = applied.components.find((c) => c.type === 'chart')
    expect(chart.props.truncated).toBe(true)
    expect(chart.props.total).toBe(60)
    expect(chart.props.sampled).toBe(chart.props.values.length)
    expect(chart.props.values.length).toBeLessThanOrEqual(24)
  })
})
