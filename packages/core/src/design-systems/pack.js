/**
 * Design System Pack: tokens that restyle the catalog. Never user JavaScript.
 */
import { createHash } from 'node:crypto'
import { CATALOG_TYPES } from '../jev/planner.js'

const FONT_HOSTS = new Set(['fonts.googleapis.com', 'fonts.gstatic.com'])
const MAX_CSS = 24_000

export const PACK_VERSION = 1

const STUDIO_TOKENS = {
  background: '#F8F9FB',
  ink: '#0F172A',
  card: '#FFFFFF',
  border: '#E2E8F0',
  accent: '#0F766E',
  onAccent: '#FFFFFF',
  muted: '#475569',
  danger: '#DC2626',
  radius: '8px',
  fontUi: "'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif",
  fontMono: "'JetBrains Mono', ui-monospace, monospace",
  chartColors: ['#0F766E', '#2DD4BF', '#14B8A6', '#5EEAD4', '#0D9488', '#99F6E4'],
}

export function defaultPack(id = 'studio', name = 'Studio') {
  return {
    version: PACK_VERSION,
    id,
    name,
    tokens: { ...STUDIO_TOKENS, chartColors: [...STUDIO_TOKENS.chartColors] },
    head: `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">`,
    css: '',
    supports: [...CATALOG_TYPES],
  }
}

export const STARTER_PACKS = {
  studio: defaultPack('studio', 'Studio'),
  neutral: {
    ...defaultPack('neutral', 'Neutral'),
    tokens: {
      ...STUDIO_TOKENS,
      accent: '#334155',
      onAccent: '#F8FAFC',
      chartColors: ['#334155', '#64748B', '#0F172A', '#94A3B8', '#1E293B', '#CBD5E1'],
    },
  },
  material: {
    ...defaultPack('material', 'Material'),
    tokens: {
      ...STUDIO_TOKENS,
      accent: '#6750A4',
      onAccent: '#FFFFFF',
      radius: '16px',
      chartColors: ['#6750A4', '#625B71', '#7D5260', '#B3261E', '#386A20', '#006C51'],
    },
    head: `<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@400;500&display=swap" rel="stylesheet">`,
  },
}

export function sanitizeCss(css) {
  let text = String(css || '')
  if (text.length > MAX_CSS) text = text.slice(0, MAX_CSS)
  text = text.replace(/@import[^;]+;?/gi, '')
  text = text.replace(/expression\s*\(/gi, '')
  text = text.replace(/url\s*\(\s*['"]?\s*javascript:/gi, 'url(')
  text = text.replace(/<\/?script/gi, '')
  text = text.replace(/behavior\s*:/gi, '')
  text = text.replace(/-moz-binding\s*:/gi, '')
  return text
}

export function sanitizeHead(head) {
  const raw = String(head || '')
  if (!raw.trim()) return ''
  if (/<script/i.test(raw)) return ''
  const hrefs = [...raw.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1])
  for (const href of hrefs) {
    try {
      const url = new URL(href)
      if (url.protocol !== 'https:' || !FONT_HOSTS.has(url.hostname)) return ''
    } catch {
      return ''
    }
  }
  return raw
}

function tokenColor(value, fallback) {
  const s = String(value || '').trim()
  if (/^#([0-9a-f]{3,8})$/i.test(s)) return s
  if (/^(rgb|hsl)a?\(/i.test(s)) return s
  if (/^[a-z]+$/i.test(s) && s.length < 24) return s
  return fallback
}

function tokenRadius(value, fallback) {
  const s = String(value || '').trim()
  if (/^\d+(\.\d+)?(px|rem|em|%)$/.test(s)) return s
  return fallback
}

export function normalizePack(input) {
  const base = defaultPack(input?.id || 'custom', input?.name || 'Custom')
  const tokens = { ...base.tokens }
  const src = input?.tokens || {}
  for (const key of Object.keys(STUDIO_TOKENS)) {
    if (src[key] == null) continue
    if (key === 'chartColors' && Array.isArray(src.chartColors)) {
      tokens.chartColors = src.chartColors.slice(0, 6).map((c, i) => tokenColor(c, STUDIO_TOKENS.chartColors[i]))
      continue
    }
    if (key === 'radius') {
      tokens.radius = tokenRadius(src.radius, tokens.radius)
      continue
    }
    if (key === 'fontUi' || key === 'fontMono') {
      const font = String(src[key]).replace(/[<>;]/g, '').slice(0, 120)
      if (font) tokens[key] = font
      continue
    }
    tokens[key] = tokenColor(src[key], tokens[key])
  }
  let supports = Array.isArray(input?.supports)
    ? input.supports.filter((type) => CATALOG_TYPES.includes(type))
    : [...CATALOG_TYPES]
  if (!supports.length) supports = [...CATALOG_TYPES]
  return {
    version: PACK_VERSION,
    id: String(input?.id || 'custom').slice(0, 48).replace(/[^a-z0-9_-]/gi, '-') || 'custom',
    name: String(input?.name || 'Custom').slice(0, 64),
    tokens,
    head: sanitizeHead(input?.head || base.head),
    css: sanitizeCss(input?.css || ''),
    supports,
  }
}

export function parseCssVariables(cssText) {
  const text = String(cssText || '')
  const grab = (name) => {
    const m = text.match(new RegExp(`--${name}\\s*:\\s*([^;]+)`, 'i'))
    return m ? m[1].trim() : undefined
  }
  return normalizePack({
    id: 'imported',
    name: 'Imported',
    tokens: {
      background: grab('background'),
      ink: grab('foreground'),
      card: grab('card'),
      border: grab('border'),
      accent: grab('primary') || grab('accent'),
      onAccent: grab('primary-foreground') || grab('accent-foreground'),
      muted: grab('muted-foreground'),
      danger: grab('destructive'),
      radius: grab('radius'),
      fontUi: grab('font-sans'),
      fontMono: grab('font-mono'),
    },
  })
}

function w3cValue(node) {
  if (node == null) return undefined
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (typeof node === 'object' && node.$value != null) return String(node.$value)
  if (typeof node === 'object' && node.value != null) return String(node.value)
  return undefined
}

export function parseTokensJson(raw) {
  let data = raw
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw)
    } catch {
      return normalizePack({ id: 'invalid', name: 'Invalid' })
    }
  }
  if (data?.tokens) return normalizePack(data)
  const color = data?.color || {}
  const font = data?.fontFamily || data?.font || {}
  const dim = data?.dimension || data?.size || {}
  return normalizePack({
    id: data?.id || 'tokens',
    name: data?.name || 'Tokens',
    tokens: {
      background: w3cValue(color.background) || w3cValue(color.bg),
      ink: w3cValue(color.foreground) || w3cValue(color.ink) || w3cValue(color.text),
      card: w3cValue(color.card) || w3cValue(color.surface),
      border: w3cValue(color.border),
      accent: w3cValue(color.accent) || w3cValue(color.primary),
      onAccent: w3cValue(color.onAccent) || w3cValue(color.onPrimary),
      muted: w3cValue(color.muted),
      danger: w3cValue(color.danger) || w3cValue(color.destructive),
      radius: w3cValue(dim.radius),
      fontUi: w3cValue(font.sans) || w3cValue(font.ui),
      fontMono: w3cValue(font.mono),
    },
    supports: data?.supports,
    css: data?.css,
    head: data?.head,
  })
}

export function packHash(pack) {
  const normalized = normalizePack(pack || {})
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16)
}

export function packToTheme(pack) {
  const p = normalizePack(pack || {})
  const t = p.tokens
  const charts = (t.chartColors || STUDIO_TOKENS.chartColors).join(',')
  return {
    head: p.head,
    chartColors: t.chartColors,
    css: `
:root{color-scheme:light dark;--pack-bg:${t.background};--pack-ink:${t.ink};--pack-card:${t.card};--pack-border:${t.border};--pack-accent:${t.accent};--pack-on-accent:${t.onAccent};--pack-muted:${t.muted};--pack-danger:${t.danger};--pack-radius:${t.radius}}
body{font-family:${t.fontUi};background:var(--pack-bg);color:var(--pack-ink)}
.card,.stat,.record-list li,.land-block,.price-card,.auth-card,.set-block,.cal-days li{background:var(--pack-card);border-color:var(--pack-border);border-radius:var(--pack-radius)}
.auth-submit,.work-tool.is-on{background:var(--pack-accent);color:var(--pack-on-accent);border-color:var(--pack-accent)}
.stat-value,th,.badge{font-family:${t.fontMono}}
.price-card.is-featured{border-color:var(--pack-accent)}
${p.css}
`.trim(),
    chartColors: t.chartColors || charts.split(','),
  }
}

export function catalogFromPack(pack) {
  const p = normalizePack(pack || {})
  return p.supports
}

export function themeForRender(override, fallbackTheme) {
  if (!override) return fallbackTheme
  if (override.tokens) return packToTheme(override)
  return override
}

export function previewSpecs() {
  return {
    login: {
      title: 'Sign in',
      summary: 'Sample login',
      presentation: 'page',
      components: [{
        type: 'login-form',
        props: {
          brand: 'Acme',
          kicker: 'Sample',
          subtitle: 'Your tokens restyle this card.',
          submitLabel: 'Continue',
          fields: [
            { name: 'email', label: 'Email', type: 'email', required: true },
            { name: 'password', label: 'Password', type: 'password', required: true },
          ],
        },
      }],
    },
    landing: {
      title: 'Acme',
      summary: 'Sample landing',
      presentation: 'page',
      components: [{
        type: 'landing-page',
        props: {
          brand: 'Acme',
          kicker: 'Sample',
          headline: 'Ship the UI you described',
          cta: 'Get started',
          sections: [{ kind: 'hero', copy: 'Connecting a look restyles the catalog. It does not invent new widgets.' }],
        },
      }],
    },
  }
}
