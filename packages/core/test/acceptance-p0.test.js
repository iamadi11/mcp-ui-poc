/**
 * P0 acceptance: agent memory + dynamic generate. Black-box public exports.
 * If product code still fails these, leave them red — do not weaken.
 */
import { describe, it, expect } from 'vitest'
import {
  planUI,
  generateUiHtml,
  sessionGoal,
  effectivePrompt,
  isIteratePrompt,
  catalogCannotExpress,
  promptPayload,
  jevAvailable,
  getDesignSystem,
} from '../src/index.js'

const designSystem = {
  id: 'test',
  name: 'Test',
  components: [
    { type: 'checkout', description: 'cart' },
    { type: 'work-stage', description: 'board' },
  ],
}

const SNITCH_CREATE =
  'create checkout for clothing brand Snitch, graffiti animation on load'
const GRAFFITI_FOLLOW_UP = 'graffiti is not visible'
const TIC_TAC_TOE = 'Create a game of tic tac toe with heavy animation'

const STRIDE_CHECKOUT_POLICY = {
  presentation: 'page',
  componentTypes: ['checkout'],
  title: 'Stride',
  summary: 'Demo cart for Stride',
}

function jevAnswers(extra = {}) {
  return {
    presentation: { choice: 'page', confidence: 0.9 },
    density: { score: 1, confidence: 0.9 },
    named_widget: { choice: 'none', confidence: 0.2 },
    chart_type: { choice: 'bar', confidence: 0.2 },
    include_stat_grid: { noul: 0.05 },
    include_table: { noul: 0.05 },
    include_chart: { noul: 0.05 },
    include_list: { noul: 0.05 },
    include_key_value: { noul: 0.05 },
    include_text: { noul: 0.05 },
    include_badge_row: { noul: 0.05 },
    include_alert: { noul: 0.05 },
    include_action_row: { noul: 0.05 },
    in_catalog: { noul: 0.1 },
    needs_llm: { noul: 0.95 },
    needs_motion: { noul: 0.9 },
    motion: { choice: 'stagger', confidence: 0.85 },
    ...extra,
  }
}

function blob(value) {
  return JSON.stringify(value)
}

function htmlBlockProps(spec) {
  return spec.components.find((c) => c.type === 'html-block')?.props || {}
}

function renderTheme(spec) {
  return getDesignSystem('shadcn').render(spec)
}

/** Host stagger is mcp-enter on the shell. Live graffiti must be inner CSS/script. */
function hasInnerLoadMotion(css, script, rendered) {
  const pack = `${css || ''}\n${script || ''}\n${rendered || ''}`
  const named = /@keyframes\s+[^{\s]*(graffiti|spray|paint|drip|tag|burst)/i.test(pack)
  const anim = /animation\s*:\s*[^\n;]*(graffiti|spray|paint|drip|tag|burst)/i.test(pack)
  const keyframes = /@keyframes/.test(css || '')
  const scriptMotion = /requestAnimationFrame|animate\(|Web Animations/i.test(script || '')
  return named || anim || (keyframes && /animation\s*:/.test(css || '')) || scriptMotion
}

function isWordmarkOnly(innerHtml) {
  const html = String(innerHtml || '')
  const commerce = /cart|checkout|pay|hoodie|qty|quantity|subtotal|\btotal\b|price/i.test(html)
  const tags = (html.match(/<(div|section|article|ul|li|button|form|table)\b/gi) || []).length
  return !commerce && tags <= 2
}

function isPlayableTicTacToe(innerHtml, script, rendered) {
  const html = `${innerHtml || ''}\n${rendered || ''}`
  const cells = (html.match(/<button\b[^>]*(cell|data-index|gridcell)|role=["']gridcell["']/gi) || []).length
  const binds = /addEventListener\s*\(|\.onclick\s*=|querySelector(All)?\s*\(/i.test(script || rendered || '')
  return cells >= 9 && binds && !/work-stage|Workspace generated/i.test(html)
}

describe('P0 (a) Snitch clothing checkout generates; not Stride shoes', () => {
  it('routes the create prompt out of catalog with Snitch/clothing in the bound fixture', () => {
    expect(catalogCannotExpress(SNITCH_CREATE)).toBe(true)
    expect(isIteratePrompt(SNITCH_CREATE)).toBe(false)
    const packed = promptPayload(SNITCH_CREATE)
    expect(packed.source).toBe('demo:generated')
    expect(blob(packed.data)).toMatch(/snitch|clothing/i)
    expect(blob(packed.data)).not.toMatch(/Aero Runner/)
    expect(blob(packed.data)).not.toMatch(/Court Low/)
    expect(packed.data.channel).not.toBe('Checkout')
  })

  it('plans html-block generate with graffiti motion, never a Stride catalog cart', async () => {
    const packed = promptPayload(SNITCH_CREATE)
    let generateArgs = null
    const { spec, planner, policy } = await planUI({
      data: packed.data,
      sourceUrl: packed.source,
      instructions: SNITCH_CREATE,
      designSystem,
      fresh: true,
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: jevAnswers({
          named_widget: { choice: 'checkout', confidence: 0.95 },
          include_checkout: { noul: 0.95 },
          in_catalog: { noul: 0.9 },
        }),
      }),
      generateUi: async (args) => {
        generateArgs = args
        return {
          title: 'Snitch',
          html: '<div class="snitch-cart"><h2>Oversized Graffiti Hoodie</h2><span>Qty: 1</span><span>$89</span></div>',
          css: '@keyframes graffiti-spray { from { opacity: 0; transform: scale(.5) } to { opacity: 1; transform: none } } .snitch-cart { animation: graffiti-spray 1.2s ease both }',
          script: 'document.querySelector(".snitch-cart")',
        }
      },
    })

    expect(planner).toBe('haiku:generate')
    expect(planner).not.toBe('replay')
    expect(spec.components.map((c) => c.type)).toEqual(['html-block'])
    expect(spec.motion).toBe('stagger')
    expect(generateArgs?.instructions).toMatch(/snitch|clothing/i)
    expect(generateArgs?.instructions).toMatch(/graffiti/i)
    expect(generateArgs?.motion === 'stagger' || spec.motion === 'stagger').toBe(true)
    expect(blob(spec)).toMatch(/snitch/i)
    expect(blob(spec)).not.toMatch(/Aero Runner/)
    expect(blob(spec)).not.toMatch(/Court Low/)
    expect(blob(spec)).not.toMatch(/"checkout"/)
    expect(policy.componentTypes).toEqual(['html-block'])

    const props = htmlBlockProps(spec)
    const html = renderTheme(spec)
    expect(isWordmarkOnly(props.html)).toBe(false)
    expect(html).toMatch(/data-motion="stagger"/)
    expect(html).toMatch(/mcp-enter/)
    expect(hasInnerLoadMotion(props.css, props.script, html)).toBe(true)
    expect(html).toMatch(/@keyframes\s+graffiti-spray/)
    expect(html).toMatch(/animation:\s*graffiti-spray/)
  })

  it('live quality: a SNITCH wordmark with no inner animation fails the graffiti bar', async () => {
    const packed = promptPayload(SNITCH_CREATE)
    const { spec, planner } = await planUI({
      data: packed.data,
      sourceUrl: packed.source,
      instructions: SNITCH_CREATE,
      designSystem,
      fresh: true,
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: jevAnswers({
          named_widget: { choice: 'checkout', confidence: 0.95 },
          include_checkout: { noul: 0.95 },
        }),
      }),
      generateUi: async () => ({
        title: 'Snitch',
        html: '<h1>SNITCH</h1>',
        css: '',
      }),
    })

    expect(planner).toBe('haiku:generate')
    const props = htmlBlockProps(spec)
    const html = renderTheme(spec)
    expect(html).toMatch(/data-motion="stagger"/)
    expect(isWordmarkOnly(props.html)).toBe(true)
    expect(hasInnerLoadMotion(props.css, props.script, html)).toBe(true)
  })
})

describe('P0 (b) graffiti follow-up keeps Snitch checkout, not a new wall', () => {
  it('treats the follow-up as iterate but catalogCannotExpress alone is not a new product', () => {
    expect(isIteratePrompt(GRAFFITI_FOLLOW_UP)).toBe(true)
    expect(catalogCannotExpress(GRAFFITI_FOLLOW_UP)).toBe(true)

    const history = [{ role: 'user', text: SNITCH_CREATE }]
    const goal = sessionGoal('', history, GRAFFITI_FOLLOW_UP)
    expect(goal).toMatch(/snitch/i)
    expect(goal).toMatch(/checkout/i)

    const trap = promptPayload(GRAFFITI_FOLLOW_UP)
    expect(trap.source).toBe('demo:generated')
    expect(blob(trap.data)).not.toMatch(/snitch/i)

    const bound = promptPayload(goal)
    expect(blob(bound.data)).toMatch(/snitch|clothing/i)
    expect(blob(bound.data)).not.toMatch(/Aero Runner/)
  })

  it('plans a Snitch checkout revision when history and goal are present', async () => {
    const history = [{ role: 'user', text: SNITCH_CREATE }]
    const goal = sessionGoal('', history, GRAFFITI_FOLLOW_UP)
    const instructions = effectivePrompt({
      current: GRAFFITI_FOLLOW_UP,
      history,
      goal,
    })
    const packed = promptPayload(goal)
    let seen = null
    const { spec, planner } = await planUI({
      data: packed.data,
      sourceUrl: packed.source,
      instructions,
      goal,
      history,
      previousPolicy: {
        componentTypes: ['html-block'],
        html: '<div class="snitch-cart">hoodie</div>',
        title: 'Snitch',
        motion: 'stagger',
      },
      designSystem,
      fresh: true,
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: jevAnswers({ named_widget: { choice: 'none', confidence: 0.2 } }),
      }),
      generateUi: async (args) => {
        seen = args
        return {
          title: 'Snitch',
          html: '<div class="snitch-cart spray">hoodie checkout</div>',
          css: '.spray{animation:spray 1s}',
        }
      },
    })

    expect(planner).toBe('haiku:generate')
    expect(spec.components.map((c) => c.type)).toEqual(['html-block'])
    expect(spec.components[0].props.html).toMatch(/snitch-cart/)
    expect(blob(spec)).not.toMatch(/Graffiti Wall/i)
    expect(blob(spec)).not.toMatch(/message wall/i)
    expect(seen?.goal).toMatch(/snitch/i)
    expect(seen?.instructions).toMatch(/Original request:[\s\S]*snitch/i)
    expect(seen?.instructions).toMatch(/This turn: graffiti is not visible/i)
    expect(seen?.previous?.html || seen?.previous).toBeTruthy()
  })

  it('forwards goal and previous checkout into generateUiHtml so Haiku cannot invent a wall', async () => {
    let payload = null
    const slots = await generateUiHtml({
      instructions: effectivePrompt({
        current: GRAFFITI_FOLLOW_UP,
        goal: SNITCH_CREATE,
        history: [{ role: 'user', text: SNITCH_CREATE }],
      }),
      goal: SNITCH_CREATE,
      history: [{ role: 'user', text: SNITCH_CREATE }],
      previous: { html: '<div class="snitch-cart">hoodie</div>', componentTypes: ['html-block'] },
      generateUi: async (args) => {
        payload = args
        return { title: 'Snitch', html: '<div class="snitch-cart spray">hoodie</div>' }
      },
    })
    expect(payload.goal).toMatch(/snitch/i)
    expect(payload.history[0].text).toMatch(/snitch/i)
    expect(payload.previous.html).toMatch(/snitch-cart/)
    expect(slots.title).toMatch(/snitch/i)
    expect(slots.html).toMatch(/snitch-cart/)
    expect(slots.html).not.toMatch(/Graffiti Wall/i)
  })
})

describe('P0 (c) tic-tac-toe is generate, not a workspace board', () => {
  it('is a create prompt, not iterate, and catalog cannot express a game', () => {
    expect(isIteratePrompt(TIC_TAC_TOE)).toBe(false)
    expect(catalogCannotExpress(TIC_TAC_TOE)).toBe(true)
  })

  it('binds a generate fixture and plans html-block, never work-stage', async () => {
    const packed = promptPayload(TIC_TAC_TOE)
    expect(packed.source).toBe('demo:generated')
    expect(blob(packed.data)).not.toMatch(/Workspace generated/)

    const { spec, planner, policy } = await planUI({
      data: packed.data,
      sourceUrl: packed.source,
      instructions: TIC_TAC_TOE,
      designSystem,
      fresh: true,
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: jevAnswers({
          named_widget: { choice: 'work-stage', confidence: 0.9 },
          include_work_stage: { noul: 0.9 },
        }),
      }),
      generateUi: async () => ({
        title: 'Tic-tac-toe',
        html: '<div class="board" role="grid"><button type="button">play</button></div>',
        css: '.board{display:grid}',
        script: 'document.querySelector(".board")',
      }),
    })

    expect(planner).toBe('haiku:generate')
    expect(spec.components.map((c) => c.type)).toEqual(['html-block'])
    expect(spec.components[0].props.html).toContain('board')
    expect(spec.motion).toBe('stagger')
    expect(policy.html).toContain('board')
    expect(blob(spec)).not.toMatch(/Workspace generated/)
    expect(blob(spec)).not.toMatch(/work-stage/)
  })
})

describe('P0 (d) same create prompt twice with fresh:true is never replay', () => {
  it('does not replay a cached Stride cart when fresh is set', async () => {
    const packed = promptPayload(SNITCH_CREATE)
    const plan = (cachedPolicy) =>
      planUI({
        data: packed.data,
        sourceUrl: packed.source,
        instructions: SNITCH_CREATE,
        designSystem,
        cachedPolicy,
        fresh: true,
        askJev: async () => ({
          model: 'jev-1.13.0',
          answers: jevAnswers({
            named_widget: { choice: 'checkout', confidence: 0.95 },
            include_checkout: { noul: 0.95 },
          }),
        }),
        generateUi: async () => ({
          title: 'Snitch',
          html: '<div class="snitch-cart">hoodie</div>',
        }),
      })

    const first = await plan(undefined)
    expect(first.planner).not.toBe('replay')
    expect(first.cached).not.toBe(true)
    expect(first.spec.components.map((c) => c.type)).toEqual(['html-block'])

    const second = await plan(STRIDE_CHECKOUT_POLICY)
    expect(second.planner).not.toBe('replay')
    expect(second.cached).not.toBe(true)
    expect(second.spec.components.map((c) => c.type)).toEqual(['html-block'])
    expect(blob(second.spec)).not.toMatch(/Aero Runner/)
    expect(blob(second.spec)).not.toMatch(/"Stride"/)
    expect(blob(second.spec)).toMatch(/snitch/i)
  })
})

describe('P0 (e) env TypeSafe key is enough; empty Settings field is not missing', () => {
  it('jevAvailable is true when TYPESAFE_API_KEY is set even if the request key is empty', () => {
    const prev = process.env.TYPESAFE_API_KEY
    try {
      process.env.TYPESAFE_API_KEY = 'ts_env_present'
      expect(jevAvailable()).toBe(true)
      expect(jevAvailable('')).toBe(true)
      expect(jevAvailable(undefined)).toBe(true)
    } finally {
      if (prev !== undefined) process.env.TYPESAFE_API_KEY = prev
      else delete process.env.TYPESAFE_API_KEY
    }
  })

  it('jevAvailable is false only when neither env nor request key is set', () => {
    const prev = process.env.TYPESAFE_API_KEY
    try {
      delete process.env.TYPESAFE_API_KEY
      expect(jevAvailable()).toBe(false)
      expect(jevAvailable('')).toBe(false)
      expect(jevAvailable('ts_session')).toBe(true)
    } finally {
      if (prev !== undefined) process.env.TYPESAFE_API_KEY = prev
      else delete process.env.TYPESAFE_API_KEY
    }
  })
})
