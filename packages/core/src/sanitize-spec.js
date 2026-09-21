import { isSafeHttpUrl } from './safe-url.js'

/**
 * Collect absolute http(s) URL strings from untrusted fetched data.
 */
export function collectHttpUrls(value, out = new Set(), depth = 0) {
  if (depth > 10 || value == null) return out
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (isSafeHttpUrl(trimmed)) out.add(trimmed)
    return out
  }
  if (Array.isArray(value)) {
    for (const item of value) collectHttpUrls(item, out, depth + 1)
    return out
  }
  if (typeof value === 'object') {
    for (const v of Object.values(value)) collectHttpUrls(v, out, depth + 1)
  }
  return out
}

/**
 * Defense-in-depth for #5 residual: action-row links must be http(s) and appear
 * in sourceUrl or the fetched data payload. Unknown/injected URLs become notifies.
 */
export function sanitizeSpecActions(spec, { data, sourceUrl } = {}) {
  if (!spec || typeof spec !== 'object') return spec
  const allowed = collectHttpUrls(data)
  if (isSafeHttpUrl(sourceUrl)) allowed.add(String(sourceUrl).trim())

  const components = (spec.components || []).map((component) => {
    if (component.type !== 'action-row') return component
    const actions = (component.props?.actions || []).map((action) => {
      if (!action || typeof action !== 'object') return action
      if (action.action === 'notify') return action
      const url = action.url
      if (isSafeHttpUrl(url) && allowed.has(String(url).trim())) {
        return { ...action, action: action.action || 'link', url: String(url).trim() }
      }
      return {
        label: action.label || 'Link',
        action: 'notify',
        message: 'Link blocked: URL not present in trusted source data.',
      }
    })
    return {
      ...component,
      props: {
        ...(component.props || {}),
        actions,
      },
    }
  })

  return { ...spec, components }
}
