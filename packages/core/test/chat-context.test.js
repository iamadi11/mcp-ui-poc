import { describe, it, expect } from 'vitest'
import { normalizeChatHistory, mergeChatHistory, sessionGoal, effectivePrompt } from '../src/chat-context.js'
import { generateUiHtml } from '../src/generate-ui.js'
import { planUI } from '../src/planner.js'
import { demoPayload } from '../src/demo-payload.js'

describe('chat context', () => {
  it('keeps only user turns and drops thoughts', () => {
    const history = normalizeChatHistory([
      { role: 'user', text: 'Create a Snitch checkout with graffiti on load' },
      { role: 'thought', text: 'Asking Jev' },
      { role: 'user', text: 'Graffiti is not visible on load.' },
    ])
    expect(history.map((turn) => turn.text)).toEqual([
      'Create a Snitch checkout with graffiti on load',
      'Graffiti is not visible on load.',
    ])
  })

  it('pins the first user ask as the session goal', () => {
    const history = [
      { role: 'user', text: 'Create a checkout for snitch with graffiti on load' },
      { role: 'user', text: 'Graffiti is not visible on load.' },
    ]
    expect(sessionGoal('', history, 'Graffiti is not visible on load.')).toMatch(/snitch/i)
  })

  it('wraps a follow-up with the original request', () => {
    const prompt = effectivePrompt({
      current: 'Graffiti is not visible on load.',
      goal: 'Create a checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.',
      history: [
        { role: 'user', text: 'Create a checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.' },
      ],
    })
    expect(prompt).toMatch(/Original request:[\s\S]*snitch/i)
    expect(prompt).toMatch(/This turn: Graffiti is not visible on load/i)
  })
})

describe('planUI with chat context', () => {
  it('sends the original checkout ask to Haiku on a graffiti follow-up', async () => {
    const goal = 'Can you create checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.'
    const current = 'Graffiti is not visible on load.'
    const instructions = effectivePrompt({
      current,
      goal,
      history: [{ role: 'user', text: goal }],
    })
    const data = demoPayload(goal)
    let seen = ''
    const { planner, spec } = await planUI({
      data,
      sourceUrl: 'demo:generated',
      instructions,
      goal,
      history: [{ role: 'user', text: goal }],
      designSystem: { id: 'test', name: 'Test', components: [] },
      previousPolicy: {
        componentTypes: ['html-block'],
        html: '<div class="snitch-cart">hoodie</div>',
        title: 'Snitch',
      },
      askJev: async () => ({
        model: 'jev-1.13.0',
        answers: { named_widget: { choice: 'none' }, in_catalog: { noul: 0.1 } },
      }),
      generateUi: async ({ instructions: text }) => {
        seen = text
        return { title: 'Snitch', html: '<div class="snitch-cart spray">hoodie</div>' }
      },
    })
    expect(planner).toBe('haiku:generate')
    expect(seen).toMatch(/Original request:[\s\S]*snitch/i)
    expect(seen).toMatch(/This turn: Graffiti is not visible/i)
    expect(spec.components[0].props.html).toContain('snitch-cart')
    expect(JSON.stringify(spec)).not.toMatch(/Graffiti Wall/i)
  })

  it('revises the Snitch checkout when the follow-up is only the graffiti complaint', async () => {
    const goal = 'Can you create checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.'
    const current = 'graffiti is not visible'
    const previousHtml = '<section class="snitch-cart"><h1>Snitch</h1><p>Clothing checkout</p></section>'
    let captured = null
    let jevPrompt = ''
    const { planner, spec } = await planUI({
      data: demoPayload(goal),
      sourceUrl: 'demo:generated',
      instructions: current,
      goal,
      history: [{ role: 'user', text: goal }, { role: 'user', text: current }],
      designSystem: { id: 'test', name: 'Test', components: [] },
      previousPolicy: {
        componentTypes: ['html-block'],
        title: 'Snitch',
        kicker: 'Clothing',
        html: previousHtml,
        css: '.snitch-cart{color:red}',
        script: 'document.querySelector(".snitch-cart")',
      },
      askJev: async ({ state }) => {
        jevPrompt = state.prompt
        return {
          model: 'jev-1.13.0',
          answers: { named_widget: { choice: 'none' }, in_catalog: { noul: 0.1 } },
        }
      },
      generateUi: async (args) => {
        captured = args
        const context = [args.instructions, args.goal, JSON.stringify(args.history), args.previous?.html, args.previous?.title].join('\n')
        if (!/snitch/i.test(context) || !/checkout|clothing|hoodie/i.test(context) || !args.previous?.html) {
          return { title: 'Graffiti Wall', kicker: 'Street', html: '<div class="wall">leave a spray-paint message</div>' }
        }
        return {
          title: 'Snitch checkout',
          kicker: 'Clothing',
          html: `${args.previous.html}<span class="graffiti-spray">tag</span>`,
          css: '@keyframes graffiti-load { from { opacity: 0 } to { opacity: 1 } } .graffiti-spray { animation: graffiti-load 600ms ease both }',
        }
      },
    })
    expect(planner).toBe('haiku:generate')
    expect(jevPrompt).toMatch(/snitch/i)
    expect(jevPrompt).toMatch(/checkout/i)
    expect(captured.goal).toMatch(/snitch/i)
    expect(captured.history.some((turn) => /snitch/i.test(turn.text || turn))).toBe(true)
    expect(captured.previous.html).toContain('snitch-cart')
    expect(captured.instructions).toMatch(/snitch/i)
    expect(spec.components.map((c) => c.type)).toEqual(['html-block'])
    expect(spec.title).toMatch(/snitch/i)
    expect(spec.components[0].props.kicker).toMatch(/clothing/i)
    expect(spec.components[0].props.html).toMatch(/snitch/i)
    expect(spec.components[0].props.html).toMatch(/checkout|hoodie|clothing/i)
    expect(JSON.stringify(spec)).not.toMatch(/Graffiti Wall/i)
    expect(JSON.stringify(spec)).not.toMatch(/spray-paint message/i)
  })
})

describe('generateUiHtml context', () => {
  it('forwards history into the injected generator', async () => {
    let payload = null
    await generateUiHtml({
      instructions: 'This turn: add graffiti on load',
      goal: 'Snitch checkout',
      history: [{ role: 'user', text: 'Snitch checkout' }],
      generateUi: async (args) => {
        payload = args
        return { title: 'Snitch', html: '<div>ok</div>' }
      },
    })
    expect(payload.goal).toBe('Snitch checkout')
    expect(payload.history[0].text).toBe('Snitch checkout')
  })
})
