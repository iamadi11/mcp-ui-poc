/**
 * In-studio records for turns that describe a UI. Live JSON URLs still win
 * when the prompt (or session) has one. Fixtures are never the prompt text.
 */
import {
  classifySurface,
  catalogCannotExpress,
  isProductSurface,
  titleFromPrompt,
  workspaceFixture,
  DEMO_WORKSPACE_SOURCE,
} from './surface.js'

export {
  classifySurface,
  catalogCannotExpress,
  isProductSurface,
  titleFromPrompt,
  workspaceFixture,
  DEMO_WORKSPACE_SOURCE,
}

export const DEMO_CHECKOUT_SOURCE = 'demo:checkout'
export const DEMO_LOGIN_SOURCE = 'demo:login'
export const DEMO_LANDING_SOURCE = 'demo:landing'
export const DEMO_PRICING_SOURCE = 'demo:pricing'
export const DEMO_FORM_SOURCE = 'demo:form'
export const DEMO_SETTINGS_SOURCE = 'demo:settings'
export const DEMO_CALENDAR_SOURCE = 'demo:calendar'
export const DEMO_GENERATED_SOURCE = 'demo:generated'
export const DEMO_SKETCH_SOURCE = 'demo:sketch'

function checkoutFixture(prompt) {
  const brand = brandFromPrompt(prompt, 'Stride')
  return {
    store: brand,
    channel: 'Checkout',
    notice: `Demo cart for ${brand} — include an orders API URL in the message to hydrate live checkouts.`,
    items: [
      { product: 'Aero Runner', color: 'Ink', size: '9', qty: 1, price: 129 },
      { product: 'Court Low', color: 'White', size: '8.5', qty: 1, price: 98 },
      { product: 'Trail laces', color: 'Black', size: '—', qty: 2, price: 12 },
    ],
    totals: {
      items: 4,
      subtotal: 251,
      shipping: 8,
      tax: 20.08,
      total: 279.08,
    },
  }
}

const LOGIN_FIELDS = [
  { field: 'Email', type: 'email', required: 'Yes' },
  { field: 'Password', type: 'password', required: 'Yes' },
  { field: 'Keep me signed in', type: 'checkbox', required: 'No' },
]

function loginFixture(prompt) {
  const brand = brandFromPrompt(prompt, 'Stride')
  return {
    store: brand,
    channel: 'Sign in',
    notice: `Sign in to ${brand}. Follow up to change copy, color, or motion.`,
    items: LOGIN_FIELDS.map((item) => ({ ...item })),
  }
}

const LANDING = {
  store: 'Stride',
  channel: 'Landing',
  notice: 'Demo landing — follow up to change copy, color, or sections.',
  items: [
    { block: 'Hero', copy: 'Run further. Look sharper.', cta: 'Shop the drop' },
    { block: 'Proof', copy: '12k runners this week', cta: 'See stories' },
    { block: 'Product', copy: 'Aero Runner and Court Low', cta: 'Browse pairs' },
    { block: 'Footer', copy: 'Shipping in 2 days', cta: 'Help' },
  ],
  totals: { sections: 4, ctas: 4 },
}

const PRICING = {
  store: 'Stride Club',
  channel: 'Pricing',
  notice: 'Demo plans — follow up to change tiers or highlight a plan.',
  items: [
    { plan: 'Starter', price: 0, perks: 'Size guide + 1 drop alert' },
    { plan: 'Member', price: 12, perks: 'Early access + free returns' },
    { plan: 'Club', price: 29, perks: 'Members-only colorways' },
  ],
  totals: { plans: 3, featured: 1 },
}

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

export function isLandingIntent(prompt) {
  return /\b(landing|marketing|hero|homepage|home page|marketing site)\b/i.test(prompt)
}

export function isPricingIntent(prompt) {
  return /\b(pricing|price plans?|subscription|plans? and pricing)\b/i.test(prompt)
}

export function isCheckoutIntent(prompt) {
  const text = String(prompt || '').toLowerCase()
  if (!text.trim()) return false
  if (/checkout|check-out|check out/.test(text)) return true
  if (/\bcart\b/.test(text) && /e-?commerce|shop|store|shoe|sneaker/.test(text)) return true
  if (/e-?commerce/.test(text) && /shoe|sneaker|footwear|shop|store|order/.test(text)) return true
  return false
}

export function isLoginIntent(prompt) {
  return /\b(log\s*in|login|sign\s*in|sign-in|signin|signon|auth(?:entication)?)\b/i.test(prompt)
}

export function brandFromPrompt(prompt, fallback = 'Stride') {
  const text = String(prompt || '')
  const called = text.match(/\b(?:brand\s+)?(?:called|named)\s+([A-Za-z][A-Za-z0-9&'’-]*)/i)
  if (called) {
    const name = called[1].replace(/[.,;:]+$/, '').trim()
    if (name.length >= 2) return name.charAt(0).toUpperCase() + name.slice(1, 56)
  }
  const forMatch = text.match(/\bfor\s+(?:the\s+)?(.+?)(?:[.!?\n]|$)/i)
  if (forMatch) {
    const name = forMatch[1]
      .replace(/\b(app|application|page|site|store|website|web\s*app|login|log\s*in|sign[-\s]?in|dashboard)\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (name.length >= 2) return name.charAt(0).toUpperCase() + name.slice(1, 56)
  }
  return fallback
}

export function isFormIntent(prompt) {
  const lower = String(prompt || '').toLowerCase()
  if (isLoginIntent(prompt)) return false
  return /\b(contact form|signup form|sign-up form|feedback form)\b/.test(lower)
    || (/\bform\b/.test(lower) && !/\bdashboard\b/.test(lower))
}

export function isSettingsIntent(prompt) {
  return /\b(account settings|settings page|user settings|preferences)\b/i.test(prompt)
}

export function isCalendarIntent(prompt) {
  return /\bcalendar\b/i.test(prompt)
}

function formFixture(prompt) {
  const brand = brandFromPrompt(prompt, 'Studio')
  return {
    store: brand,
    channel: 'Form',
    notice: `Reach ${brand}. Follow up to change fields, copy, or look.`,
    items: [
      { field: 'Name', type: 'text', required: 'Yes' },
      { field: 'Email', type: 'email', required: 'Yes' },
      { field: 'Message', type: 'text', required: 'Yes' },
    ],
  }
}

function settingsFixture(prompt) {
  const brand = brandFromPrompt(prompt, 'Account')
  return {
    store: brand,
    channel: 'Settings',
    notice: 'Update profile, notifications, and security. Follow up to change copy or look.',
    items: [
      { field: 'Display name', type: 'text', required: 'Yes', group: 'Profile' },
      { field: 'Email', type: 'email', required: 'Yes', group: 'Profile' },
      { field: 'Product emails', type: 'checkbox', required: 'No', group: 'Notifications' },
      { field: 'Two-factor authentication', type: 'checkbox', required: 'No', group: 'Security' },
    ],
  }
}

function calendarFixture(prompt) {
  const title = titleFromPrompt(prompt)
  return {
    store: title,
    channel: 'Calendar',
    notice: 'Week view generated from your prompt. Follow up to change copy or look.',
    items: [
      { title: 'Kickoff', subtitle: 'Mon 9:00', meta: '30m' },
      { title: 'Design review', subtitle: 'Wed 14:00', meta: '45m' },
      { title: 'Ship check', subtitle: 'Fri 11:00', meta: '25m' },
    ],
  }
}

function generatedFixture(prompt) {
  const title = titleFromPrompt(prompt)
  const brand = brandFromPrompt(prompt, '')
  return {
    store: brand || title,
    channel: 'Generated',
    notice: 'Generated from your prompt. Follow up to change the UI, look, or motion.',
  }
}

export function sketchFromPrompt(prompt) {
  const title = titleFromPrompt(prompt)
  return {
    store: title,
    channel: 'App',
    notice: 'Generated from your prompt. Include a JSON URL in the message to hydrate live records.',
    items: [
      { block: 'Primary', copy: `${title} — main view`, status: 'Ready' },
      { block: 'Details', copy: 'Supporting content and actions', status: 'Ready' },
      { block: 'Next', copy: 'Follow up to refine layout, color, or motion', status: 'Iterate' },
    ],
    totals: { views: 3, actions: 1, version: 1 },
  }
}

export function promptPayload(prompt) {
  const text = String(prompt || '').trim()
  if (!text) return null
  if (catalogCannotExpress(text)) return { data: generatedFixture(text), source: DEMO_GENERATED_SOURCE }
  if (isCheckoutIntent(text)) return { data: checkoutFixture(text), source: DEMO_CHECKOUT_SOURCE }
  if (isLoginIntent(text)) return { data: loginFixture(text), source: DEMO_LOGIN_SOURCE }
  if (isLandingIntent(text)) return { data: clone(LANDING), source: DEMO_LANDING_SOURCE }
  if (isPricingIntent(text)) return { data: clone(PRICING), source: DEMO_PRICING_SOURCE }
  if (isFormIntent(text)) return { data: formFixture(text), source: DEMO_FORM_SOURCE }
  if (isSettingsIntent(text)) return { data: settingsFixture(text), source: DEMO_SETTINGS_SOURCE }
  if (isCalendarIntent(text)) return { data: calendarFixture(text), source: DEMO_CALENDAR_SOURCE }
  const surface = classifySurface(text)
  if (isProductSurface(surface)) {
    return { data: workspaceFixture(text, surface), source: DEMO_WORKSPACE_SOURCE }
  }
  if (!surface.catalog || surface.kind === 'unknown') {
    return { data: generatedFixture(text), source: DEMO_GENERATED_SOURCE }
  }
  return { data: sketchFromPrompt(text), source: DEMO_SKETCH_SOURCE }
}

/** Data only — used by tests and older call sites. */
export function demoPayload(prompt) {
  return promptPayload(prompt)?.data || null
}

const BY_SOURCE = {
  [DEMO_CHECKOUT_SOURCE]: (prompt) => checkoutFixture(prompt),
  [DEMO_LOGIN_SOURCE]: (prompt) => loginFixture(prompt),
  [DEMO_LANDING_SOURCE]: () => clone(LANDING),
  [DEMO_PRICING_SOURCE]: () => clone(PRICING),
  [DEMO_FORM_SOURCE]: (prompt) => formFixture(prompt),
  [DEMO_SETTINGS_SOURCE]: (prompt) => settingsFixture(prompt),
  [DEMO_CALENDAR_SOURCE]: (prompt) => calendarFixture(prompt),
  [DEMO_GENERATED_SOURCE]: (prompt) => generatedFixture(prompt),
  [DEMO_WORKSPACE_SOURCE]: (prompt) => workspaceFixture(prompt),
}

export function isNamedCatalogSource(sourceUrl) {
  return Boolean(BY_SOURCE[String(sourceUrl || '')])
}

export function payloadForDemoSource(sourceUrl, prompt) {
  const load = BY_SOURCE[String(sourceUrl || '')]
  if (load) return load(prompt)
  if (String(sourceUrl || '') === DEMO_SKETCH_SOURCE) return sketchFromPrompt(prompt)
  return demoPayload(prompt)
}

export function emptySourceSpec() {
  return {
    title: 'Describe a UI',
    summary: 'Ask for a checkout, landing page, or dashboard. Include a JSON URL in the message to hydrate live records.',
    presentation: 'page',
    motion: 'none',
    components: [
      {
        type: 'alert',
        props: {
          severity: 'info',
          message: 'Send a prompt to generate a widget. Follow-ups upgrade the current one.',
        },
      },
    ],
  }
}
