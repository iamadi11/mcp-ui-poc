/**
 * Haiku generates out-of-catalog UIs as HTML. Jev still chooses look / motion /
 * iterate vs create. ThemeAdapter wraps the result with pack tokens.
 */
import { inferShape } from './shape.js'
import { getLLMAdapter } from './llm/registry.js'
import { sanitizeCss } from './design-systems/pack.js'
import { isCheckoutIntent, brandFromPrompt } from './demo-payload.js'
import { withUntrustedDataSystem, formatUntrustedShapeBlock } from './untrusted-data.js'

const MAX_HTML = 40_000
const MAX_SCRIPT = 16_000

const GENERATED_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    kicker: { type: 'string' },
    html: { type: 'string', description: 'Inner HTML for the widget. No html/body/script tags.' },
    css: { type: 'string', description: 'Optional extra CSS. No @import or scripts.' },
    script: {
      type: 'string',
      description: 'Optional interactivity. No fetch, eval, storage, or external URLs.',
    },
  },
  required: ['title', 'html'],
  additionalProperties: false,
}

const SCRIPT_BAN =
  /\b(fetch|XMLHttpRequest|eval|WebSocket|localStorage|sessionStorage|indexedDB|importScripts|SharedWorker|document\.cookie)\b|\bnew\s+Function\b|\bnew\s+Worker\b|\bimport\s*\(|\brequire\s*\(/

export function extractEmbeddedScripts(html) {
  let script = ''
  const next = String(html || '').replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, body) => {
    script += `${body}\n`
    return ''
  })
  return { html: next, script }
}

export function sanitizeGeneratedHtml(html) {
  let text = String(html || '')
  if (text.length > MAX_HTML) text = text.slice(0, MAX_HTML)
  text = text.replace(/<!DOCTYPE[\s\S]*?>/i, '')
  text = text.replace(/<\/?(html|head|body|iframe|object|embed|link|meta|base|frame|frameset)[^>]*>/gi, '')
  text = text.replace(/<script[\s\S]*?<\/script>/gi, '')
  text = text.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  text = text.replace(/javascript:/gi, '')
  text = text.replace(/data:\s*text\/html/gi, '')
  return text
}

export function publicGenerateError(error) {
  const status = error?.status || error?.statusCode
  const msg = String(error?.message || error?.error?.message || 'Haiku failed to generate this UI.')
  if (/api key|authentication|unauthorized|401/i.test(msg) || status === 401) {
    return 'Anthropic rejected the API key. Check Settings or ANTHROPIC_API_KEY in .env.local.'
  }
  if (status === 429 || /rate limit/i.test(msg)) {
    return 'Anthropic rate-limited this generate. Wait a moment and try again.'
  }
  if (/timeout|timed out/i.test(msg)) {
    return 'Haiku timed out while generating this UI. Try again.'
  }
  return 'Haiku could not generate this UI. Try again, or simplify the prompt.'
}

export function sanitizeGeneratedScript(script) {
  let text = String(script || '')
  if (text.length > MAX_SCRIPT) text = text.slice(0, MAX_SCRIPT)
  if (!text.trim()) return ''
  if (SCRIPT_BAN.test(text) || /<\/script/i.test(text)) return ''
  return text
}

export function sanitizeGenerated(slots) {
  const split = extractEmbeddedScripts(slots?.html)
  const html = sanitizeGeneratedHtml(split.html)
  const script = sanitizeGeneratedScript([slots?.script, split.script].filter(Boolean).join('\n'))
  return {
    title: String(slots?.title || 'Widget').slice(0, 80),
    kicker: String(slots?.kicker || 'Generated').slice(0, 48),
    html: html.trim() || (script.trim() ? '<div id="gen-root" class="gen-mount"></div>' : ''),
    css: sanitizeCss(slots?.css || ''),
    script,
  }
}

const LOAD_MOTION_FALLBACK_CSS = [
  '@keyframes mcp-paint-in{0%{opacity:0;transform:translate3d(-10px,8px,0) rotate(-1.2deg)}100%{opacity:1;transform:none}}',
  '@keyframes mcp-spray-dots{0%{opacity:0;transform:scale(.7) translateY(6px)}100%{opacity:1;transform:none}}',
  '.gen-body,.gen-shell,.gen-mount,.mcp-checkout,.wordmark,.snitch-cart{position:relative;animation:mcp-paint-in .8s cubic-bezier(.22,1,.36,1) both}',
  '.gen-body::before,.gen-shell::before,.gen-mount::before,.mcp-checkout::before,.wordmark::before,.snitch-cart::before{',
  'content:"";position:absolute;left:-6%;bottom:8%;width:48%;height:22%;pointer-events:none;z-index:2;',
  'background:',
  'radial-gradient(circle at 14% 42%,#0F766E 0 3px,transparent 4px),',
  'radial-gradient(circle at 28% 58%,#134E4A 0 2px,transparent 3px),',
  'radial-gradient(circle at 46% 36%,#0F766E 0 2px,transparent 3px),',
  'radial-gradient(circle at 62% 64%,#115E59 0 3px,transparent 4px),',
  'linear-gradient(112deg,transparent 0 16%,rgba(15,118,110,.55) 16% 32%,transparent 32% 46%,rgba(19,78,74,.42) 46% 60%,transparent 60%);',
  'filter:blur(.15px);animation:mcp-spray-dots .95s cubic-bezier(.22,1,.36,1) both}',
].join('')

const GRAFFITI_VISUAL_FALLBACK_CSS = [
  '@keyframes mcp-spray-dots{0%{opacity:0;transform:scale(.7) translateY(6px)}100%{opacity:1;transform:none}}',
  '.gen-body,.gen-shell,.gen-mount,.mcp-checkout,.wordmark,.snitch-cart{position:relative}',
  '.gen-body::before,.gen-shell::before,.gen-mount::before,.mcp-checkout::before,.wordmark::before,.snitch-cart::before{',
  'content:"";position:absolute;left:-6%;bottom:8%;width:48%;height:22%;pointer-events:none;z-index:2;',
  'background:',
  'radial-gradient(circle at 14% 42%,#0F766E 0 3px,transparent 4px),',
  'radial-gradient(circle at 28% 58%,#134E4A 0 2px,transparent 3px),',
  'radial-gradient(circle at 46% 36%,#0F766E 0 2px,transparent 3px),',
  'radial-gradient(circle at 62% 64%,#115E59 0 3px,transparent 4px),',
  'linear-gradient(112deg,transparent 0 16%,rgba(15,118,110,.55) 16% 32%,transparent 32% 46%,rgba(19,78,74,.42) 46% 60%,transparent 60%);',
  'filter:blur(.15px);animation:mcp-spray-dots .95s cubic-bezier(.22,1,.36,1) both}',
].join('')

function contextBlob({ instructions, goal, history } = {}) {
  const turns = (Array.isArray(history) ? history : [])
    .map((turn) => (typeof turn === 'string' ? turn : turn?.text))
    .map((text) => String(text || '').trim())
    .filter(Boolean)
  return [goal, instructions, ...turns].filter(Boolean).join('\n')
}

function wantsLoadMotion(text) {
  const blob = String(text || '')
  if (/\bgraffiti|spray[- ]?paint|painted? entrance\b/i.test(blob)) return true
  if (/\banimat(?:e|ion|ions|ed)\b/i.test(blob) && /\bon (?:widget |page )?load\b/i.test(blob)) return true
  return false
}

function wantsGraffiti(text) {
  return /\bgraffiti|spray[- ]?paint\b/i.test(String(text || ''))
}

function hasPaintAnimation(css, script) {
  return /@keyframes\b|\banimation\s*:|\.animate\s*\(/i.test(`${css || ''}\n${script || ''}`)
}

function hasGraffitiVisual(css, html) {
  const pack = `${css || ''}\n${html || ''}`
  return /radial-gradient|linear-gradient|mcp-spray|paint-stripe|ink-blot|spray-dot/i.test(pack)
}

function wantsCheckout(text) {
  return isCheckoutIntent(text)
}

function hasCartMarkup(html) {
  return /\b(cart|line[- ]?item|line item|subtotal|qty|quantity|hoodie)\b/i.test(String(html || ''))
}

function hasLoginMarkup(html) {
  return /\b(email|password|sign[- ]?in|log[- ]?in|full name)\b/i.test(String(html || ''))
}

function looksLikeLoginOnly(html) {
  const text = String(html || '')
  if (!hasLoginMarkup(text)) return false
  if (hasCartMarkup(text)) return false
  return true
}

function stripLoginBlocks(html) {
  let next = String(html || '')
  next = next.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, '')
  next = next.replace(
    /<(section|div|aside)\b[^>]*(?:class|id)=["'][^"']*(?:auth|login|sign-?in|shipping|credentials)[^"']*["'][^>]*>[\s\S]*?<\/\1>/gi,
    '',
  )
  next = next.replace(
    /<label\b[^>]*>\s*(EMAIL|FULL\s*NAME|PASSWORD|PHONE|SHIPPING)[^<]*<\/label>\s*(?:<input\b[^>]*>)?/gi,
    '',
  )
  next = next.replace(/<(button|a)\b[^>]*>\s*(Sign\s*in|Log\s*in|Continue\s*with)[^<]*<\/\1>/gi, '')
  return next
}

function checkoutBrand(text, fallback = '') {
  const raw = String(text || '')
  const called = raw.match(/\b(?:brand\s+)?(?:called|named)\s+([A-Za-z][A-Za-z0-9&'’-]*)/i)
  if (called?.[1]) return called[1].charAt(0).toUpperCase() + called[1].slice(1, 40)
  const clothing = raw.match(/\b(?:clothing|apparel|fashion|streetwear)\s+brand\s+([A-Za-z][A-Za-z0-9&'’-]*)/i)
  if (clothing?.[1]) return clothing[1].charAt(0).toUpperCase() + clothing[1].slice(1, 40)
  const branded = brandFromPrompt(raw, '')
  if (branded && branded.length <= 40 && !/\b(graffiti|animation|checkout|widget)\b/i.test(branded)) {
    return branded
  }
  return fallback
}

function escText(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function checkoutCartHtml(brand) {
  const name = escText(brand || 'Bag')
  return `<section class="mcp-checkout"><h2>${name} checkout</h2><ul class="cart" aria-label="Cart"><li class="line-item">Hoodie <span>qty 1</span></li><li class="line-item">Tee <span>qty 1</span></li></ul></section>`
}

function shortCheckoutTitle(blob, currentTitle) {
  const brand = checkoutBrand(blob, '')
  const clothing = /\b(clothing|apparel|fashion|streetwear)\b/i.test(blob)
  if (!brand || !clothing) return currentTitle
  const twitchy = /graffiti|animation|on load|clothing brand|,/i.test(String(currentTitle || ''))
    || String(currentTitle || '').length > 28
  if (!twitchy && /\bcheckout\b/i.test(currentTitle) && currentTitle.length <= 28) return currentTitle
  return `${brand} checkout`.slice(0, 80)
}

function applyGeneratedFallbacks(clean, ctx = {}) {
  const blob = contextBlob(ctx)
  let next = { ...clean }

  if (wantsCheckout(blob) && looksLikeLoginOnly(next.html)) {
    const brand = checkoutBrand(blob, '')
    const clothing = /\b(clothing|apparel|fashion|streetwear)\b/i.test(blob)
    const titleIsLogin = /\b(sign[- ]?in|log[- ]?in|welcome)\b/i.test(next.title)
    const kickerIsLogin = /\b(sign[- ]?in|log[- ]?in|welcome)\b/i.test(next.kicker)
    next.title = (!titleIsLogin && /checkout/i.test(next.title)
      ? next.title
      : `${brand ? `${brand} checkout` : 'Checkout'}`).slice(0, 80)
    next.kicker = (!kickerIsLogin && /\b(checkout|clothing|cart)\b/i.test(next.kicker)
      ? next.kicker
      : (clothing ? 'Clothing checkout' : 'Checkout')).slice(0, 48)
    next.html = sanitizeGeneratedHtml(checkoutCartHtml(brand || next.title))
  } else if (wantsCheckout(blob) && hasCartMarkup(next.html) && hasLoginMarkup(next.html)) {
    const brand = checkoutBrand(blob, '')
    let stripped = stripLoginBlocks(next.html)
    if (hasLoginMarkup(stripped) || !hasCartMarkup(stripped)) {
      stripped = checkoutCartHtml(brand || next.title)
    }
    next.html = sanitizeGeneratedHtml(stripped)
    const clothing = /\b(clothing|apparel|fashion|streetwear)\b/i.test(blob)
    if (clothing || /\b(sign[- ]?in|log[- ]?in|welcome|graffiti|animation)/i.test(next.title)) {
      next.title = shortCheckoutTitle(blob, next.title)
    }
    if (/\b(sign[- ]?in|log[- ]?in|welcome)\b/i.test(next.kicker)) {
      next.kicker = (clothing ? 'Clothing checkout' : 'Checkout').slice(0, 48)
    }
  }

  if (wantsCheckout(blob) && /\b(clothing|apparel|fashion|streetwear)\b/i.test(blob)) {
    next.title = shortCheckoutTitle(blob, next.title)
  }

  if (wantsGraffiti(blob) && !hasGraffitiVisual(next.css, next.html)) {
    const inject = wantsLoadMotion(blob) && !hasPaintAnimation(next.css, next.script)
      ? LOAD_MOTION_FALLBACK_CSS
      : GRAFFITI_VISUAL_FALLBACK_CSS
    next.css = sanitizeCss([next.css, inject].filter(Boolean).join('\n'))
  } else if (wantsLoadMotion(blob) && !hasPaintAnimation(next.css, next.script)) {
    next.css = sanitizeCss([next.css, LOAD_MOTION_FALLBACK_CSS].filter(Boolean).join('\n'))
  }

  return next
}

function systemPrompt({ look, motion, accent }) {
  return withUntrustedDataSystem(
    [
      'You generate a complete UI widget as HTML for a chat-first studio.',
      'Jev already chose look and motion. You do not invent a second layout language.',
      'Return JSON only: title, kicker, html, css, script.',
      'html is the widget inner markup — no <html>, <body>, or <script> tags.',
      'Put interactivity in script (games, toggles, boards). No inline event handlers.',
      'No fetch, eval, cookies, storage, workers, or external URLs.',
      'Use semantic HTML and IBM Plex Sans. Accent color: ' + (accent || '#0F766E') + '.',
      `Look token: ${look || 'default'}. Motion token: ${motion || 'none'} is host chrome only — the motion token is not enough to animate inner markup.`,
      'If the user asked for a game, the script must be playable (win/draw/reset).',
      'If the user named a brand, category, or look (graffiti, neon, clothing), the HTML must match that — never a generic sneaker store.',
      'If they asked for animation on load, graffiti, or a painted entrance, you MUST put a real CSS @keyframes (or script) animation that runs on first paint in css/script. Do not rely on the host motion token or a data-motion attribute.',
      'For graffiti: include a VISIBLE overlay — spray dots (radial-gradient), a paint stripe (linear-gradient), or an ink blot via pure CSS. Opacity/translate fade alone is not enough. No external image URLs.',
      'If the user asked for checkout, the HTML must include cart/line items — not a login or sign-in card. Do not replace checkout with EMAIL / FULL NAME leftover fields. If both cart and login appear, keep the cart and drop the login/shipping form.',
      'Follow-ups revise the previous HTML to satisfy the original request. Do not replace a checkout, game, or form with a different product such as a graffiti message wall. Do not replace a checkout with a login or sign-in form.',
      'Keep the brand, category, and product from the conversation goal in title, kicker, and html.',
      'Titles must be short (under ~28 chars). Prefer "Snitch checkout" over long prompts like "Clothing brand Snitch, graffiti animation on load".',
    ].join(' '),
  )
}

function historyBlock(history) {
  const texts = (Array.isArray(history) ? history : [])
    .map((turn) => (typeof turn === 'string' ? turn : turn?.text))
    .map((text) => String(text || '').trim())
    .filter(Boolean)
    .slice(-8)
  if (!texts.length) return null
  return `Recent user asks:\n${texts.map((text, i) => `${i + 1}. ${text}`).join('\n')}`
}

export async function generateUiHtml({
  instructions,
  data,
  sourceUrl,
  look,
  motion,
  previous,
  pack,
  apiKey,
  llmProvider,
  generateUi,
  history,
  goal,
} = {}) {
  const finish = (slots) => {
    const clean = sanitizeGenerated(slots)
    if (!clean.html.trim()) return { error: 'Haiku returned empty markup.' }
    return applyGeneratedFallbacks(clean, { instructions, goal, history })
  }

  if (typeof generateUi === 'function') {
    try {
      const slots = await generateUi({
        instructions,
        look,
        motion,
        previous,
        history,
        goal,
      })
      return finish(slots)
    } catch (error) {
      return { error: publicGenerateError(error) }
    }
  }

  const provider = llmProvider || process.env.LLM_PROVIDER || 'anthropic'
  let adapter
  try {
    adapter = getLLMAdapter(provider)
  } catch {
    return { error: 'No Anthropic adapter is configured.' }
  }
  if (!adapter.isAvailable(apiKey)) {
    return { error: 'No Anthropic key configured. Add one in Settings or set ANTHROPIC_API_KEY.' }
  }

  const excerpt = String(instructions || '').slice(0, 2000)
  const shape = inferShape(data)
  const prev = previous?.html ? String(previous.html).slice(0, 8000) : ''
  const accent = pack?.tokens?.accent
  const blob = contextBlob({ instructions, goal, history })
  try {
    const slots = await adapter.generateStructured({
      apiKey,
      system: systemPrompt({ look, motion, accent }),
      userContent: [
        excerpt ? `User instructions: ${excerpt}` : null,
        goal ? `Conversation goal: ${String(goal).slice(0, 500)}` : null,
        historyBlock(history),
        wantsCheckout(blob)
          ? 'Product: checkout. Include cart/line items (product, qty, price). Do not replace this checkout with a login or sign-in form. If cart and login both appear, keep cart and drop the login/shipping form.'
          : null,
        wantsGraffiti(blob)
          ? 'Graffiti must be visibly painted on load: CSS spray dots (radial-gradient), a paint stripe (linear-gradient), or an ink blot. A fade/opacity-only animation is not enough. Keep the original product UI — do not invent a graffiti message wall.'
          : null,
        `Look: ${look || 'default'}`,
        `Motion: ${motion || 'none'}`,
        sourceUrl && !String(sourceUrl).startsWith('demo:') ? `Source: ${sourceUrl}` : null,
        formatUntrustedShapeBlock(shape),
        prev ? `Previous HTML:\n${prev}` : null,
        previous?.css ? `Previous CSS:\n${String(previous.css).slice(0, 4000)}` : null,
        previous?.script ? `Previous script:\n${String(previous.script).slice(0, 4000)}` : null,
      ].filter(Boolean).join('\n\n'),
      schema: GENERATED_SCHEMA,
      maxTokens: 8192,
      thinking: false,
    })
    return finish(slots)
  } catch (error) {
    return { error: publicGenerateError(error) }
  }
}

export function generatedPolicy(slots, hints = {}) {
  const clean = sanitizeGenerated(slots)
  return {
    presentation: 'page',
    motion: hints.motion || 'none',
    look: hints.look === 'vivid' ? 'vivid' : 'default',
    radius: hints.radius || '',
    title: clean.title,
    summary: hints.summary || 'Generated from your prompt.',
    componentTypes: ['html-block'],
    html: clean.html,
    css: clean.css,
    script: clean.script,
    kicker: clean.kicker,
    drawer: false,
  }
}
