/**
 * In-studio demo records for turns that describe an app but attach no API.
 * Values are fixtures — never the prompt text.
 */

export const DEMO_CHECKOUT_SOURCE = 'demo:checkout'

const SHOE_CHECKOUT = {
  store: 'Stride',
  channel: 'Checkout',
  notice: 'Demo cart — attach an orders API to hydrate live checkouts.',
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

function cloneCheckout() {
  return JSON.parse(JSON.stringify(SHOE_CHECKOUT))
}

export function isCheckoutIntent(prompt) {
  const text = String(prompt || '').toLowerCase()
  if (!text.trim()) return false
  if (/checkout|check-out|check out/.test(text)) return true
  if (/\bcart\b/.test(text) && /e-?commerce|shop|store|shoe|sneaker/.test(text)) return true
  if (/e-?commerce/.test(text) && /shoe|sneaker|footwear|shop|store|order/.test(text)) return true
  return false
}

export function demoPayload(prompt) {
  if (isCheckoutIntent(prompt)) return cloneCheckout()
  return null
}

export function payloadForDemoSource(sourceUrl, prompt) {
  if (String(sourceUrl || '') === DEMO_CHECKOUT_SOURCE) return cloneCheckout()
  return demoPayload(prompt)
}

export function emptySourceSpec() {
  return {
    title: 'Add an API',
    summary: 'Paste a JSON URL, or ask for a checkout demo (cart, ecommerce, shoes).',
    presentation: 'page',
    motion: 'none',
    components: [
      {
        type: 'alert',
        props: {
          severity: 'info',
          message:
            'No API attached. Pin a public JSON URL to hydrate live records, or describe a checkout to preview a demo cart.',
        },
      },
    ],
  }
}
