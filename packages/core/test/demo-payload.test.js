import { describe, it, expect } from 'vitest'
import { demoPayload } from '../src/demo-payload.js'
import { heuristicPlan } from '../src/planner.js'
import { applyPolicy, extractPolicy } from '../src/layout-policy.js'

const CHECKOUT_PROMPT = 'create a dashboard for ecommerce checkout app for shoes'

function layoutFrom(data, instructions) {
  const spec = heuristicPlan(data, '', instructions)
  return applyPolicy(extractPolicy(spec, data), data, '')
}

describe('demo checkout payload', () => {
  it('hydrates a shoe cart instead of treating the prompt as records', () => {
    const data = demoPayload(CHECKOUT_PROMPT)
    expect(data).toBeTruthy()
    expect(JSON.stringify(data)).not.toMatch(/No API attached/)
    expect(JSON.stringify(data).toLowerCase()).not.toContain(CHECKOUT_PROMPT)

    const spec = layoutFrom(data, CHECKOUT_PROMPT)
    const blob = JSON.stringify(spec)
    expect(blob).not.toMatch(/No API attached/)
    expect(blob).not.toMatch(/"PROMPT"/i)
    expect(spec.title.toLowerCase()).toMatch(/checkout/)
    const stats = spec.components.find((c) => c.type === 'stat-grid')
    const labels = (stats?.props?.items || []).map((item) => item.label).join(' ')
    expect(labels).toMatch(/Total|Subtotal/)
    expect(labels).not.toMatch(/Note/)
    const table = spec.components.find((c) => c.type === 'table')
    expect(table?.title).toMatch(/Cart|Order/i)
    const rowText = JSON.stringify(table?.props?.rows || []).toLowerCase()
    expect(rowText).toMatch(/runner|court|trail|sneaker|shoe/)
    expect(table?.props?.rows?.length).toBeGreaterThan(1)
    const chart = spec.components.find((c) => c.type === 'chart')
    expect(chart?.title.toLowerCase()).toMatch(/price/)
  })

  it('does not invent a checkout cart for an unrelated prompt', () => {
    expect(demoPayload('explain this widget')).toBeNull()
  })
})
