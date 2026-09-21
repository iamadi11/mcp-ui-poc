/**
 * Product-UI classifier. Dashboards bind JSON records; tools and unknown
 * apps bind a workspace — never fake Primary/Details/Next rows.
 */

export const DEMO_WORKSPACE_SOURCE = 'demo:workspace'

function isGamePrompt(text) {
  const s = String(text || '')
  if (/\b(tic[- ]?tac[- ]?toe|noughts\s+and\s+crosses|chess|checkers|connect\s*four|hangman|minesweeper|sudoku)\b/i.test(s)) {
    return true
  }
  if (/\bgame of\b/i.test(s)) return true
  if (/\b(playable|board)\s+games?\b/i.test(s)) return true
  return false
}

/** Catalog primitives cannot honor custom brand, look, games, or load animation. */
export function catalogCannotExpress(prompt) {
  const text = String(prompt || '')
  if (!text.trim()) return false
  if (/\b(graffiti|spray[- ]?paint|neon|glitch|cyberpunk|hand[- ]drawn|comic|pixel[- ]art|skeuomorph)\b/i.test(text)) {
    return true
  }
  if (/\b(?:brand\s+)?(?:called|named)\s+[A-Za-z]/i.test(text)) return true
  if (/\b(clothing|apparel|fashion|streetwear)\b/i.test(text)) return true
  if (/\banimat(?:e|ion|ions|ed)\b/i.test(text) && /\bon (?:widget |page )?load\b/i.test(text)) {
    return true
  }
  if (isGamePrompt(text)) return true
  return false
}

export function titleFromPrompt(prompt) {
  const cleaned = String(prompt || '')
    .replace(/^(please\s+)?(create|build|make|generate|show|design|explain)(?:\s+(?:an?|the)(?=\s))?\s+/i, '')
    .trim()
  const line = cleaned.split(/[.!\n]/)[0].trim()
  if (!line) return 'App'
  return line.charAt(0).toUpperCase() + line.slice(1, 48)
}

export function isProductSurface(surface) {
  const kind = surface?.kind
  const main = surface?.main
  if (['form', 'settings', 'calendar'].includes(main)) return false
  return kind === 'tool' && surface?.catalog !== false
}

export function classifySurface(prompt, sourceUrl = '') {
  const text = String(prompt || '')
  const lower = text.toLowerCase()
  const source = String(sourceUrl || '')
  const hasLiveUrl = source.startsWith('http') || /https?:\/\//i.test(text)

  if (source === 'demo:login' || /\b(log\s*in|login|sign\s*in|sign-in|signin)\b/i.test(text)) {
    return { kind: 'auth', main: 'form', catalog: true, tools: [] }
  }
  if (source === 'demo:checkout' || /checkout|check-out|check out/.test(lower)) {
    if (catalogCannotExpress(text)) {
      return { kind: 'commerce', main: 'generated', catalog: false, tools: [], title: titleFromPrompt(text) }
    }
    return { kind: 'commerce', main: 'checkout', catalog: true, tools: [] }
  }
  if (source === 'demo:landing' || /\b(landing|homepage|home page|marketing site)\b/.test(lower)) {
    if (catalogCannotExpress(text)) {
      return { kind: 'marketing', main: 'generated', catalog: false, tools: [], title: titleFromPrompt(text) }
    }
    return { kind: 'marketing', main: 'landing-page', catalog: true, tools: [] }
  }
  if (source === 'demo:pricing' || /\b(pricing|price plans?)\b/.test(lower)) {
    return { kind: 'commerce', main: 'pricing', catalog: true, tools: [] }
  }
  if (source === 'demo:form' || (/\b(contact form|signup form|sign-up form|feedback form)\b/.test(lower) || (/\bform\b/.test(lower) && !/\b(log\s*in|login|sign\s*in|dashboard)\b/.test(lower)))) {
    return { kind: 'unknown', main: 'form', catalog: true, tools: [], title: titleFromPrompt(text) }
  }
  if (source === 'demo:settings' || /\b(account settings|settings page|user settings|preferences)\b/.test(lower)) {
    return { kind: 'unknown', main: 'settings', catalog: true, tools: [], title: titleFromPrompt(text) }
  }
  if (source === 'demo:calendar' || /\bcalendar\b/.test(lower)) {
    return { kind: 'tool', main: 'calendar', catalog: true, tools: [], title: titleFromPrompt(text) }
  }
  if (source === 'demo:generated') {
    return { kind: 'unknown', main: 'generated', catalog: false, tools: [], title: titleFromPrompt(text) }
  }

  if (catalogCannotExpress(text)) {
    return { kind: 'unknown', main: 'generated', catalog: false, tools: [], title: titleFromPrompt(text) }
  }

  const spatial = /\b(google\s*maps?|maps?\s+layer|mapbox|leaflet|openstreetmap|\bosm\b|gis|geojson|polygon|polyline|lat(?:itude)?|long(?:itude)?|\blng\b)\b/i.test(text)
    || (/\bmap\b/i.test(text) && /\b(draw|layer|generat|editor|plot|area|shape|marker|pin|create)\b/i.test(text))

  if (spatial && !hasLiveUrl) {
    return {
      kind: 'tool',
      main: 'map',
      catalog: true,
      tools: ['select', 'polygon', 'delete'],
      title: /\bgoogle\s*maps?\b/i.test(text) ? 'Google Maps' : titleFromPrompt(text),
    }
  }

  if (!hasLiveUrl && /\b(editor|generator|builder|playground|whiteboard|kanban|wizard)\b/i.test(lower)) {
    return {
      kind: 'tool',
      main: 'board',
      catalog: true,
      tools: ['select', 'note', 'delete'],
      title: titleFromPrompt(text),
    }
  }

  if (hasLiveUrl || /\bdashboard\b/.test(lower)) {
    return { kind: 'records', main: 'records', catalog: true, tools: [] }
  }

  return {
    kind: 'unknown',
    main: 'generated',
    catalog: false,
    tools: [],
    title: titleFromPrompt(text),
  }
}

export function workspaceFixture(prompt, surface) {
  const classified = surface || classifySurface(prompt)
  const title = classified.title || titleFromPrompt(prompt)
  const map = classified.main === 'map'
  const layers = map
    ? [
        { name: 'Base map', kind: 'tiles', status: 'On' },
        { name: 'Polygons', kind: 'vector', status: 'Editable' },
      ]
    : [
        { name: 'Canvas', kind: 'board', status: 'Ready' },
        { name: 'Notes', kind: 'overlay', status: 'Empty' },
      ]
  return {
    surface: classified.kind,
    mode: map ? 'map' : 'board',
    store: title,
    channel: 'Workspace',
    notice: map
      ? `Google Maps JavaScript API when a Maps key is set (Settings or GOOGLE_MAPS_API_KEY). Follow up to change tools, copy, or motion.`
      : `Workspace generated from your prompt. Follow up to change tools, copy, or motion.`,
    tools: Array.isArray(classified.tools) && classified.tools.length ? classified.tools : ['select'],
    items: layers.map((layer) => ({
      title: layer.name,
      subtitle: layer.kind,
      meta: layer.status,
    })),
  }
}
