export const CREATE_STARTERS = [
  { label: 'Login', value: 'Create a login page' },
  { label: 'Dashboard', value: 'Create a dashboard' },
  { label: 'Landing', value: 'Create a landing page for a shoes store' },
  { label: 'Checkout', value: 'Create a checkout for a shoes store' },
]

const RECORDS_CHIPS = [
  { label: 'Make it vivid', value: 'make it vivid' },
  { label: 'Hide the table', value: 'hide the table' },
  { label: 'Bar chart', value: 'make it a bar chart' },
]

const PAGE_CHIPS = [
  { label: 'Make it vivid', value: 'make it vivid' },
  { label: 'Rounder corners', value: 'rounder corners' },
]

const GENERATED_CHIPS = [
  { label: 'Make it vivid', value: 'make it vivid' },
  { label: 'Revise this look', value: 'revise the look to match the original ask more closely' },
]

const AUTH_CHIPS = [
  { label: 'Make it vivid', value: 'make it vivid' },
  { label: 'Tighter card', value: 'tighter card' },
]

export function widgetType(result) {
  return result?.spec?.components?.[0]?.type
    || result?.policy?.componentTypes?.[0]
    || ''
}

export function iterateChipsFor(result) {
  const planner = String(result?.meta?.planner || result?.planner || '')
  const type = widgetType(result)
  if (planner.startsWith('haiku') || planner === 'html-block' || type === 'html-block') {
    return GENERATED_CHIPS
  }
  if (type === 'login-form' || type === 'form' || type === 'settings') return AUTH_CHIPS
  if (type === 'landing-page' || type === 'checkout' || type === 'pricing' || type === 'calendar') {
    return PAGE_CHIPS
  }
  if (type === 'work-stage') return PAGE_CHIPS
  return RECORDS_CHIPS
}

export function widgetKindLabel(result) {
  const type = widgetType(result)
  const labels = {
    'login-form': 'Login',
    'landing-page': 'Landing',
    checkout: 'Checkout',
    pricing: 'Pricing',
    form: 'Form',
    settings: 'Settings',
    calendar: 'Calendar',
    'work-stage': 'Workspace',
    'html-block': 'Generated',
    table: 'Dashboard',
    'stat-grid': 'Dashboard',
    chart: 'Dashboard',
  }
  return labels[type] || 'Widget'
}
