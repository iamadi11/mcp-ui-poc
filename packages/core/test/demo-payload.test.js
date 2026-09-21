import { describe, it, expect } from 'vitest'
import { demoPayload, isLoginIntent, brandFromPrompt, promptPayload } from '../src/demo-payload.js'
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
    expect(spec.components.map((c) => c.type)).toEqual(['checkout'])
    const lines = spec.components[0].props.lines || []
    expect(JSON.stringify(lines).toLowerCase()).toMatch(/runner|court|trail|sneaker|shoe/)
    expect(lines.length).toBeGreaterThan(1)
    expect(spec.components[0].props.totals?.total).toBeTruthy()
  })

  it('brands a named checkout from the prompt', () => {
    const data = demoPayload('Create a checkout page for flipkart')
    expect(data.store).toMatch(/Flipkart/i)
    const spec = layoutFrom(data, 'Create a checkout page for flipkart')
    expect(spec.components.map((c) => c.type)).toEqual(['checkout'])
    expect(spec.components[0].props.brand).toMatch(/Flipkart/i)
  })

  it('routes a branded graffiti checkout to generate instead of the Stride cart', () => {
    const prompt = 'Can you create checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.'
    expect(brandFromPrompt(prompt)).toBe('Snitch')
    const packed = promptPayload(prompt)
    expect(packed.source).toBe('demo:generated')
    expect(packed.data.store).toMatch(/Snitch/i)
    expect(JSON.stringify(packed.data)).not.toMatch(/Aero Runner/)
  })

  it('sketches an app layout for an unmatched prompt instead of using the prompt as records', () => {
    const packed = promptPayload('explain this widget')
    expect(packed.source).toBe('demo:generated')
    expect(JSON.stringify(packed.data)).not.toMatch(/No API attached/)
    expect(packed.data.prompt).toBeUndefined()
    expect(packed.data.items).toBeUndefined()
    expect(JSON.stringify(packed.data)).not.toMatch(/Primary/)
  })

  it('builds a sign-in card from a login prompt, including the word login', () => {
    expect(isLoginIntent('create a login page for Tata 1mg')).toBe(true)
    expect(brandFromPrompt('create a login page for Tata 1mg')).toBe('Tata 1mg')
    const data = demoPayload('create a login page for Tata 1mg')
    expect(data.store).toBe('Tata 1mg')
    expect(JSON.stringify(data).toLowerCase()).toMatch(/email/)
    const spec = layoutFrom(data, 'create a login page for Tata 1mg')
    expect(spec.components.map((c) => c.type)).toEqual(['login-form'])
    expect(spec.components[0].props.brand).toBe('Tata 1mg')
    expect(spec.components[0].props.submitLabel).toMatch(/sign in/i)
    expect(JSON.stringify(spec)).not.toMatch(/"table"/)
  })

  it('builds a map workspace for a polygon generator prompt, not Primary/Details rows', () => {
    const prompt = 'create a polygon generator on google maps layer'
    const data = demoPayload(prompt)
    expect(data.mode).toBe('map')
    expect(JSON.stringify(data)).not.toMatch(/Primary/)
    const spec = layoutFrom(data, prompt)
    expect(spec.components.map((c) => c.type)).toEqual(['work-stage'])
    expect(spec.components[0].props.mode).toBe('map')
    expect(spec.components[0].props.tools).toEqual(expect.arrayContaining(['polygon']))
    expect(spec.components[0].props.title.toLowerCase()).toMatch(/google maps|polygon/)
  })

  it('builds a map workspace when the user asks for a Google Maps polygon dashboard', () => {
    const prompt =
      'can you create me a dashboard using google maps and shadcn where user can create polygons on google map'
    const data = demoPayload(prompt)
    expect(data.mode).toBe('map')
    expect(JSON.stringify(data)).not.toMatch(/Primary/)
    const spec = layoutFrom(data, prompt)
    expect(spec.components.map((c) => c.type)).toEqual(['work-stage'])
    expect(spec.components[0].props.mode).toBe('map')
    expect(spec.components[0].props.tools).toEqual(expect.arrayContaining(['polygon']))
  })

  it('builds a contact form instead of a workspace board', () => {
    const spec = layoutFrom(demoPayload('Create a contact form'), 'Create a contact form')
    expect(spec.components.map((c) => c.type)).toEqual(['form'])
    expect(JSON.stringify(spec)).not.toMatch(/Workspace generated/)
  })
})
