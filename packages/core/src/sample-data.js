/**
 * Compact sample of arbitrary data for the AI planner: caps arrays and string
 * length so giant payloads do not blow up the prompt.
 */
export function sampleData(data, { maxItems = 25, maxChars = 14000 } = {}) {
  const trim = (value, depth = 0) => {
    if (Array.isArray(value)) {
      return value.slice(0, depth === 0 ? maxItems : 8).map((v) => trim(v, depth + 1))
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .slice(0, 40)
          .map(([k, v]) => [k, trim(v, depth + 1)]),
      )
    }
    if (typeof value === 'string' && value.length > 300) return `${value.slice(0, 300)}…`
    return value
  }
  let text = JSON.stringify(trim(data), null, 1)
  if (text.length > maxChars) text = `${text.slice(0, maxChars)}…(truncated)`
  return text
}
