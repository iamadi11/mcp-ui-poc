import { describe, it, expect } from 'vitest'
import { sanitizeGeneratedHtml, sanitizeGeneratedScript, sanitizeGenerated, generatedPolicy, generateUiHtml } from '../src/generate-ui.js'
import { getDesignSystem } from '../src/design-systems/registry.js'

describe('sanitize generated UI', () => {
  it('strips document chrome, scripts, and javascript URLs from HTML', () => {
    const html = sanitizeGeneratedHtml(
      '<!DOCTYPE html><html><body><a href="javascript:alert(1)">x</a><script>steal()</script><iframe src="https://evil"></iframe><p onclick="alert(1)">ok</p></body></html>',
    )
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/javascript:/i)
    expect(html).not.toMatch(/<iframe/i)
    expect(html).not.toMatch(/onclick/i)
    expect(html).toContain('ok')
  })

  it('drops scripts that fetch or eval', () => {
    expect(sanitizeGeneratedScript('fetch("/x")')).toBe('')
    expect(sanitizeGeneratedScript('eval("1")')).toBe('')
    expect(sanitizeGeneratedScript('document.querySelector(".board").textContent="X"')).toContain('querySelector')
  })

  it('moves embedded script tags into the script field instead of dropping the UI', () => {
    const slots = sanitizeGenerated({
      title: 'Tic-tac-toe',
      html: '<div class="board"></div><script>document.querySelector(".board")</script>',
    })
    expect(slots.html).toContain('board')
    expect(slots.html).not.toMatch(/<script/i)
    expect(slots.script).toContain('querySelector')
  })

  it('keeps a mount node when Haiku only returns a script', () => {
    const slots = sanitizeGenerated({
      title: 'Game',
      html: '<script>document.body.append("ok")</script>',
    })
    expect(slots.html).toContain('gen-root')
    expect(slots.script).toContain('append')
  })
})

describe('generatedPolicy', () => {
  it('stores html-block for ThemeAdapter', () => {
    const policy = generatedPolicy({
      title: 'Tic-tac-toe',
      html: '<div class="board"></div>',
      script: 'document.querySelector(".board")',
    }, { motion: 'stagger', look: 'vivid' })
    expect(policy.componentTypes).toEqual(['html-block'])
    expect(policy.motion).toBe('stagger')
    expect(policy.look).toBe('vivid')
  })
})

describe('generateUiHtml', () => {
  it('uses the injected generator and sanitizes the result', async () => {
    const slots = await generateUiHtml({
      instructions: 'Create a game of tic tac toe',
      generateUi: async () => ({
        title: 'Tic-tac-toe',
        html: '<div class="board"><script>bad()</script></div>',
        script: 'document.querySelector(".board")',
      }),
    })
    expect(slots.title).toBe('Tic-tac-toe')
    expect(slots.html).toContain('board')
    expect(slots.html).not.toMatch(/<script/i)
  })

  it('returns an error object when the injected generator throws', async () => {
    const slots = await generateUiHtml({
      instructions: 'Create a game of tic tac toe',
      generateUi: async () => {
        throw new Error('401 authentication')
      },
    })
    expect(slots.html).toBeUndefined()
    expect(slots.error).toMatch(/API key/i)
  })

  it('puts goal, history, and previous HTML in the model userContent on follow-up', async () => {
    const { registerLLMAdapter } = await import('../src/llm/registry.js')
    let captured = null
    registerLLMAdapter({
      id: 'spy-haiku',
      name: 'Spy',
      isAvailable: () => true,
      generateStructured: async (args) => {
        captured = args
        return {
          title: 'Snitch checkout',
          kicker: 'Clothing',
          html: '<section class="snitch-cart">hoodie</section>',
          css: '@keyframes graffiti-load { from { opacity: 0 } to { opacity: 1 } } .spray { animation: graffiti-load .6s ease both }',
        }
      },
    })
    const slots = await generateUiHtml({
      instructions: 'graffiti is not visible',
      goal: 'Can you create checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.',
      history: [
        { role: 'user', text: 'Can you create checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.' },
        { role: 'user', text: 'graffiti is not visible' },
      ],
      previous: {
        html: '<section class="snitch-cart"><h1>Snitch</h1><p>Clothing checkout</p></section>',
        script: 'document.querySelector(".snitch-cart")',
      },
      look: 'vivid',
      motion: 'stagger',
      llmProvider: 'spy-haiku',
      apiKey: 'sk-test',
    })
    expect(captured).toBeTruthy()
    expect(captured.userContent).toMatch(/Conversation goal:[\s\S]*snitch/i)
    expect(captured.userContent).toMatch(/Recent user asks:[\s\S]*snitch/i)
    expect(captured.userContent).toMatch(/Previous HTML:[\s\S]*snitch-cart/i)
    expect(captured.system).toMatch(/on first paint/i)
    expect(captured.system).toMatch(/css|script/i)
    expect(captured.system).toMatch(/motion token is not (enough|sufficient)|do not rely on the (host )?motion token/i)
    expect(slots.css).toMatch(/@keyframes graffiti-load/)
    expect(slots.css).toMatch(/animation:/)
  })

  it('injects a paint/enter @keyframes fallback when graffiti-on-load HTML is static', async () => {
    const prompt = 'Can you create checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.'
    const slots = await generateUiHtml({
      instructions: prompt,
      goal: prompt,
      generateUi: async () => ({
        title: 'SNITCH',
        kicker: 'Wordmark',
        html: '<h1 class="wordmark">SNITCH</h1>',
        css: '.wordmark{font-weight:700;letter-spacing:.2em}',
      }),
    })
    expect(slots.html).toContain('wordmark')
    expect(slots.css).toMatch(/@keyframes/)
    expect(slots.css).toMatch(/animation:/)
    expect(slots.css).toMatch(/radial-gradient|linear-gradient|mcp-spray|paint-stripe|ink-blot|spray-dot/i)
    expect(slots.css).not.toMatch(/fetch\(|eval\(|localStorage/)
    expect(slots.css).not.toMatch(/url\s*\(\s*['"]?https?:/i)
  })

  it('injects graffiti-visual CSS on follow-up when previous markup had only a fade', async () => {
    const goal = 'create checkout for clothing brand Snitch, graffiti animation on load'
    const slots = await generateUiHtml({
      instructions: 'graffiti is not visible',
      goal,
      history: [
        { role: 'user', text: goal },
        { role: 'user', text: 'graffiti is not visible' },
      ],
      previous: {
        html: '<section class="snitch-cart"><h2>Snitch checkout</h2><ul class="cart"><li class="line-item">hoodie</li></ul></section>',
        css: '@keyframes mcp-paint-in{from{opacity:0}to{opacity:1}}.snitch-cart{animation:mcp-paint-in .8s both}',
      },
      generateUi: async () => ({
        title: 'Snitch checkout',
        html: '<section class="snitch-cart"><h2>Snitch checkout</h2><ul class="cart"><li class="line-item">hoodie</li></ul></section>',
        css: '@keyframes mcp-paint-in{from{opacity:0}to{opacity:1}}.snitch-cart{animation:mcp-paint-in .8s both}',
      }),
    })
    expect(slots.html).toMatch(/snitch-cart|hoodie/i)
    expect(slots.html).not.toMatch(/Graffiti Wall/i)
    expect(slots.css).toMatch(/radial-gradient|linear-gradient|mcp-spray|paint-stripe|ink-blot|spray-dot/i)
  })

  it('asks Haiku for a visible graffiti overlay, not only a fade, when graffiti is requested', async () => {
    const { registerLLMAdapter } = await import('../src/llm/registry.js')
    let captured = null
    registerLLMAdapter({
      id: 'spy-graffiti',
      name: 'Spy graffiti',
      isAvailable: () => true,
      generateStructured: async (args) => {
        captured = args
        return {
          title: 'Snitch checkout',
          html: '<section class="snitch-cart">hoodie</section>',
          css: '@keyframes graffiti-load{from{opacity:0}to{opacity:1}}.snitch-cart{animation:graffiti-load .6s both}',
        }
      },
    })
    await generateUiHtml({
      instructions: 'graffiti is not visible',
      goal: 'create checkout for clothing brand Snitch, graffiti animation on load',
      history: [{ role: 'user', text: 'create checkout for clothing brand Snitch, graffiti animation on load' }],
      previous: { html: '<section class="snitch-cart">hoodie</section>' },
      llmProvider: 'spy-graffiti',
      apiKey: 'sk-test',
    })
    expect(captured).toBeTruthy()
    const told = `${captured.system}\n${captured.userContent}`
    expect(told).toMatch(/visible|overlay|spray|paint stroke|ink blot|stripe/i)
    expect(captured.userContent).toMatch(/Previous HTML:[\s\S]*snitch-cart/i)
  })

  it('does not inject load-motion fallback when Haiku already returned graffiti visuals + keyframes', async () => {
    const prompt = 'Add a graffiti animation on widget load'
    const slots = await generateUiHtml({
      instructions: prompt,
      generateUi: async () => ({
        title: 'Spray',
        html: '<div class="spray">tag</div>',
        css: [
          '@keyframes graffiti-load { from { opacity: 0 } to { opacity: 1 } }',
          '.spray { animation: graffiti-load .5s ease both; position:relative }',
          '.spray::before{content:"";position:absolute;inset:0;pointer-events:none;',
          'background:radial-gradient(circle at 20% 40%,#0F766E 0 3px,transparent 4px),',
          'linear-gradient(110deg,transparent 20%,rgba(15,118,110,.5) 35%,transparent 50%)}',
        ].join(''),
      }),
    })
    expect(slots.css).toMatch(/@keyframes graffiti-load/)
    expect(slots.css).toMatch(/radial-gradient/)
    expect(slots.css).not.toMatch(/mcp-paint-in/)
  })

  it('forbids replacing a clothing checkout with a login in generateUi userContent', async () => {
    const { registerLLMAdapter } = await import('../src/llm/registry.js')
    let captured = null
    registerLLMAdapter({
      id: 'spy-checkout',
      name: 'Spy checkout',
      isAvailable: () => true,
      generateStructured: async (args) => {
        captured = args
        return {
          title: 'Snitch checkout',
          kicker: 'Clothing',
          html: '<section class="snitch-cart"><ul class="cart"><li class="line-item">hoodie</li></ul></section>',
        }
      },
    })
    await generateUiHtml({
      instructions: 'Can you create checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.',
      goal: 'Can you create checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.',
      llmProvider: 'spy-checkout',
      apiKey: 'sk-test',
    })
    expect(captured).toBeTruthy()
    const told = `${captured.system}\n${captured.userContent}`
    expect(told).toMatch(/do not replace.{0,80}(checkout).{0,40}(login|sign[- ]?in)|(never|do not|must not).{0,60}(login|sign[- ]?in)/i)
    expect(told).toMatch(/cart|line items?/i)
    expect(captured.userContent).not.toMatch(/Replace the checkout with a login/i)
  })

  it('keeps Snitch checkout title/kicker and cart when the mock returns a login form', async () => {
    const prompt = 'Can you create checkout page for a clothing brand called snitch. Add a graffiti animation on widget load.'
    const slots = await generateUiHtml({
      instructions: prompt,
      goal: prompt,
      generateUi: async () => ({
        title: 'Sign in',
        kicker: 'Welcome',
        html: '<form class="auth-card"><label>EMAIL</label><input type="email"/><label>FULL NAME</label><input/><button type="submit">Sign in</button></form>',
      }),
    })
    expect(slots.title).toMatch(/snitch/i)
    expect(slots.title).toMatch(/checkout/i)
    expect(slots.kicker).toMatch(/checkout|clothing|cart/i)
    expect(slots.html).toMatch(/cart|line-item/i)
    expect(slots.html).not.toMatch(/EMAIL/)
    expect(slots.html).not.toMatch(/FULL NAME/)
    expect(slots.css).toMatch(/@keyframes/)
    expect(slots.css).toMatch(/animation:/)
  })

  it('strips login leftovers from mixed cart + EMAIL/FULL NAME checkout HTML', async () => {
    const prompt = 'create checkout for clothing brand Snitch'
    const slots = await generateUiHtml({
      instructions: prompt,
      goal: prompt,
      generateUi: async () => ({
        title: 'Clothing brand Snitch, graffiti animation on load',
        kicker: 'Welcome',
        html: [
          '<section class="mcp-checkout">',
          '<h2>Snitch</h2>',
          '<ul class="cart"><li class="line-item">Hoodie <span>qty 1</span></li></ul>',
          '<form class="auth-card shipping">',
          '<label>EMAIL</label><input type="email"/>',
          '<label>FULL NAME</label><input/>',
          '<button type="submit">Sign in</button>',
          '</form>',
          '</section>',
        ].join(''),
      }),
    })
    expect(slots.html).toMatch(/cart|line-item|Hoodie/i)
    expect(slots.html).not.toMatch(/EMAIL/)
    expect(slots.html).not.toMatch(/FULL NAME/)
    expect(slots.html).not.toMatch(/Sign in/i)
    expect(slots.title).toMatch(/^Snitch checkout$/i)
  })

  it('shortens twitchy clothing-checkout titles to Brand checkout', async () => {
    const prompt = 'create checkout for clothing brand Snitch, graffiti animation on load'
    const slots = await generateUiHtml({
      instructions: prompt,
      goal: prompt,
      generateUi: async () => ({
        title: 'Clothing brand Snitch, graffiti animation on load',
        kicker: 'Clothing',
        html: '<section class="mcp-checkout"><ul class="cart"><li class="line-item">hoodie</li></ul></section>',
        css: '@keyframes spray{to{opacity:1}}.mcp-checkout{animation:spray .5s both}',
      }),
    })
    expect(slots.title).toMatch(/^Snitch checkout$/i)
    expect(slots.title.length).toBeLessThanOrEqual(24)
  })
})

describe('ThemeAdapter html-block', () => {
  it('renders generated markup and script inside the tokenized shell', () => {
    const html = getDesignSystem('shadcn').render({
      title: 'Tic-tac-toe',
      presentation: 'page',
      motion: 'stagger',
      look: 'vivid',
      components: [{
        type: 'html-block',
        props: {
          title: 'Tic-tac-toe',
          kicker: 'Generated',
          html: '<div class="board"><button type="button">play</button></div>',
          css: '.board{display:grid}',
          script: 'document.querySelector(".board")',
        },
      }],
    })
    expect(html).toContain('class="board"')
    expect(html).toContain('document.querySelector(".board")')
    expect(html).toContain('.board{display:grid}')
    expect(html).toMatch(/data-motion="stagger"/)
    expect(html).not.toContain('Workspace generated')
  })
})
