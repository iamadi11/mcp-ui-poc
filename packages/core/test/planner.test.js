import { describe, it, expect } from 'vitest'
import { heuristicPlan, planUI, aiAvailable } from '../src/planner.js'

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
})

describe('planUI', () => {
  it('falls back to heuristic plan when no LLM provider is configured', async () => {
    const data = { foo: 'bar' }
    const designSystem = { name: 'Test', components: [] }
    const { spec, planner } = await planUI({
      data,
      sourceUrl: 'https://example.com',
      instructions: '',
      designSystem,
      llmProvider: 'anthropic',
    })
    expect(planner).toBe('heuristic')
    expect(spec.components[0].type).toBe('key-value')
  })
})

describe('aiAvailable', () => {
  it('returns false for an unconfigured provider', () => {
    expect(aiAvailable('anthropic')).toBe(false)
  })
})
