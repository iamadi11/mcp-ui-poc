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

/**
 * Hostile bar: keyframes alone ≠ graffiti. Opacity-only / tiny fade fails.
 * Visible graffiti needs a graffiti|spray|paint|… animation whose keyframes
 * move paint-like props (transform beyond tiny translateY, clip-path, text-shadow, filter, …).
 */
function extractKeyframeBodies(css, nameRe) {
  const src = String(css || '')
  const out = []
  const re = /@keyframes\s+([^{\s]+)\s*\{/gi
  let m
  while ((m = re.exec(src))) {
    const name = m[1]
    if (!nameRe.test(name)) continue
    let i = m.index + m[0].length
    let depth = 1
    while (i < src.length && depth > 0) {
      const ch = src[i]
      if (ch === '{') depth += 1
      else if (ch === '}') depth -= 1
      i += 1
    }
    out.push({ name, body: src.slice(m.index + m[0].length, i - 1) })
  }
  return out
}

function hasVisibleGraffitiMotion(css, script, rendered) {
  // Judge author / product spray CSS. Ignore host shell tokens like mcp-enter.
  const pack = `${css || ''}\n${script || ''}`
  const renderedPack = `${pack}\n${rendered || ''}`
  if (!/animation\s*:\s*[^\n;]*(graffiti|spray|paint|drip|tag|burst)/i.test(renderedPack)) return false
  // Prefer author CSS; fall back to rendered when css slot is empty.
  const blocks = extractKeyframeBodies(css || rendered || '', /(?:^|[^a-z-])(?:graffiti|spray|paint|drip|tag|burst)|(?:graffiti|spray|paint|drip|tag|burst)/i)
    .filter((b) => !/^mcp-enter|^mcp-live/i.test(b.name))
  // Host may inject mcp-spray-dots as a safety net — that counts as visible spray.
  let sawVisual = false
  for (const { name, body } of blocks) {
    const paintish = /clip-path|text-shadow|filter:|box-shadow|background(-image|-size|-position)?\s*:|stroke|fill\s*:|radial-gradient/i.test(body)
    const strongTransform = /transform\s*:[^;]*(scale|rotate|skew|translateX|translate3d|matrix)/i.test(body)
    const onlyOpacity = /opacity/.test(body) && !paintish && !strongTransform && !/transform\s*:/.test(body)
    const tinyFade =
      /opacity/.test(body) &&
      /transform\s*:[^;]*translateY\s*\(\s*-?(?:0|[1-9]|1[0-9]|2[0-4])px\s*\)/i.test(body) &&
      !paintish &&
      !/scale|rotate|skew|clip-path|text-shadow|filter:|radial-gradient/i.test(body)
    if (onlyOpacity || tinyFade) continue
    if (paintish || strongTransform) sawVisual = true
    if (/mcp-spray/i.test(name) && (paintish || strongTransform)) sawVisual = true
  }
  if (sawVisual) return true
  return /(?:spray|paint|graffiti|drip).{0,40}(?:canvas|getContext|particle)/i.test(script || '')
}

/** Author-CSS-only judge: ignores ThemeAdapter mcp-spray injection. */
function hasAuthorVisibleGraffiti(css, script) {
  const author = String(css || '')
    .replace(/@keyframes\s+mcp-[\w-]+\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\}/gi, '')
    .replace(/\.gen-body::before[\s\S]*?animation\s*:\s*mcp-spray-dots[^;]*;?/gi, '')
  // Strip appended mcp-spray block more reliably by cutting at mcp-spray-dots keyframes
  const cut = author.split(/@keyframes\s+mcp-spray-dots/i)[0]
  return hasVisibleGraffitiMotion(cut, script, '')
}

function isWordmarkOnly(innerHtml) {
  const html = String(innerHtml || '')
  const commerce = /cart|checkout|pay|hoodie|qty|quantity|subtotal|\btotal\b|price/i.test(html)
  const tags = (html.match(/<(div|section|article|ul|li|button|form|table)\b/gi) || []).length
  return !commerce && tags <= 2
}

function passesSnitchGraffitiQuality(props, rendered) {
  if (isWordmarkOnly(props?.html)) return false
  // Accept either strong author graffiti or host mcp-spray safety net on a real checkout.
  return hasVisibleGraffitiMotion(props?.css, props?.script, rendered)
}

function isPlayableTicTacToe(innerHtml, script, rendered) {
  // Do not scan the ThemeAdapter shell — it documents work-stage CSS selectors.
  const html = String(innerHtml || '')
  const pack = String(script || '')
  const cellNodes = (html.match(/<button\b[^>]*>/gi) || []).filter((b) =>
    /cell|data-index|gridcell|aria-label=["'][^"']*cell/i.test(b),
  )
  const cells = Math.max(
    cellNodes.length,
    (html.match(/data-index\s*=\s*["']?\d/gi) || []).length,
    (html.match(/role=["']gridcell["']/gi) || []).length,
  )
  const binds = /addEventListener\s*\(\s*['"]click['"]|\.onclick\s*=/i.test(pack)
  const selectsCells = /querySelector(All)?\s*\(\s*['"][^'"]*(?:cell|data-index|gridcell)/i.test(pack)
  const marksBoard = /['"]X['"]|['"]O['"]|currentPlayer|gameBoard/i.test(pack)
  return cells >= 9 && binds && selectsCells && marksBoard && !/work-stage|Workspace generated/i.test(html)
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
    expect(hasVisibleGraffitiMotion(props.css, props.script, html)).toBe(true)
    expect(passesSnitchGraffitiQuality(props, html)).toBe(true)
    expect(html).toMatch(/@keyframes\s+graffiti-spray/)
    expect(html).toMatch(/animation:\s*graffiti-spray/)
  })

  it('rejects opacity-only “graffiti” fades — keyframes alone are not visible spray', () => {
    const fadeOnly =
      '@keyframes graffiti-fade { from { opacity: 0 } to { opacity: 1 } } .brand { animation: graffiti-fade 0.8s ease both }'
    const tinySlide =
      '@keyframes graffiti-in { from { opacity: 0; transform: translateY(-8px) } to { opacity: 1; transform: translateY(0) } } .brand { animation: graffiti-in 0.6s both }'
    const spray =
      '@keyframes graffiti-spray { 0% { opacity: 0; transform: scale(.3) rotate(-20deg); clip-path: inset(100% 0 0 0); text-shadow: 0 0 0 #ff006e } 100% { opacity: 1; transform: none; clip-path: inset(0); text-shadow: 3px 3px 0 #ff006e } } .brand { animation: graffiti-spray 1.2s both }'
    expect(hasInnerLoadMotion(fadeOnly, '', '')).toBe(true)
    expect(hasVisibleGraffitiMotion(fadeOnly, '', '')).toBe(false)
    expect(hasVisibleGraffitiMotion(tinySlide, '', '')).toBe(false)
    expect(hasVisibleGraffitiMotion(spray, '', '')).toBe(true)
  })

  it('live quality: a SNITCH wordmark with no paint/spray motion fails the graffiti bar', async () => {
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
        css: '@keyframes graffiti-fade { from { opacity: 0 } to { opacity: 1 } } h1 { animation: graffiti-fade 1s }',
      }),
    })

    expect(planner).toBe('haiku:generate')
    const props = htmlBlockProps(spec)
    const html = renderTheme(spec)
    expect(html).toMatch(/data-motion="stagger"/)
    expect(isWordmarkOnly(props.html)).toBe(true)
    // Author fade-only is not graffiti even if ThemeAdapter appends mcp-spray-dots.
    expect(hasAuthorVisibleGraffiti(props.css, props.script)).toBe(false)
    expect(passesSnitchGraffitiQuality(props, html)).toBe(false)
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

    const playableHtml = Array.from({ length: 9 }, (_, i) =>
      `<button type="button" class="cell" data-index="${i}"></button>`,
    ).join('')
    const playableScript = `
      const cells = document.querySelectorAll('.cell');
      let currentPlayer = 'X';
      const gameBoard = Array(9).fill(null);
      cells.forEach((cell) => cell.addEventListener('click', () => {
        const i = Number(cell.dataset.index);
        if (gameBoard[i]) return;
        gameBoard[i] = currentPlayer;
        cell.textContent = currentPlayer;
        currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
      }));
    `

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
        html: `<div class="board" role="grid">${playableHtml}</div>`,
        css: '.board{display:grid;grid-template-columns:repeat(3,1fr)} .cell{animation:pop .4s both} @keyframes pop{from{transform:scale(0)}to{transform:none}}',
        script: playableScript,
      }),
    })

    expect(planner).toBe('haiku:generate')
    expect(spec.components.map((c) => c.type)).toEqual(['html-block'])
    expect(spec.components[0].props.html).toContain('board')
    expect(spec.motion).toBe('stagger')
    expect(policy.html).toContain('board')
    expect(blob(spec)).not.toMatch(/Workspace generated/)
    expect(blob(spec)).not.toMatch(/work-stage/)

    const props = htmlBlockProps(spec)
    const rendered = renderTheme(spec)
    expect(isPlayableTicTacToe(props.html, props.script, rendered)).toBe(true)
    expect(blob(rendered)).not.toMatch(/Workspace generated/)
  })

  it('fails playability when the board is decorative (no click handlers / wrong selectors)', () => {
    const html = '<div class="board">' +
      Array.from({ length: 9 }, (_, i) => `<button class="ttt-cell" data-index="${i}"></button>`).join('') +
      '</div>'
    // Selects .cell but DOM uses .ttt-cell — unplayable mismatch Haiku sometimes ships.
    const script = 'document.querySelectorAll(".cell").forEach((c)=>c.addEventListener("click",()=>{}))'
    expect(isPlayableTicTacToe(html, script, '')).toBe(false)
    const fixed =
      'const cells=document.querySelectorAll(".ttt-cell"); let currentPlayer="X"; const gameBoard=[]; cells.forEach((c)=>c.addEventListener("click",()=>{c.textContent=currentPlayer}))'
    expect(isPlayableTicTacToe(html, fixed, '')).toBe(true)
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
