/**
 * Frozen DecisionAdapter I/O. Jev, heuristic, and a future on-device model
 * all answer the same questions. Do not rename ids without a new adapter version.
 */
export const INTENT_CHOICES = [
  'create_dashboard',
  'create_widget',
  'iterate',
  'fetch_api',
  'publish',
  'explain',
]

export const SURFACE_CHOICES = ['page', 'modal', 'component']

export const SURFACE_KIND_CHOICES = ['records', 'auth', 'tool', 'marketing', 'commerce', 'unknown']

export const TOOL_PRIMITIVE_CHOICES = ['none', 'map', 'board']

export const MOTION_TOKENS = ['none', 'enter', 'stagger', 'live']

export const NAMED_WIDGET_CHOICES = [
  'none',
  'table',
  'chart',
  'list',
  'stat-grid',
  'key-value',
  'login-form',
  'form',
  'settings',
  'calendar',
  'work-stage',
  'landing-page',
  'checkout',
  'pricing',
]

export const PATCH_QUESTION_IDS = [
  'patch_hide_table',
  'patch_tooltip',
  'patch_chart_bar',
  'patch_chart_line',
  'patch_chart_pie',
  'patch_motion',
  'patch_look_vivid',
  'patch_drawer',
]

export const ROUTING_QUESTION_IDS = [
  'intent',
  'surface',
  'surface_kind',
  'tool_primitive',
  'named_widget',
  'chart_type',
  'density',
  'needs_fetch',
  'needs_motion',
  'needs_llm',
  'in_catalog',
  'motion',
  ...PATCH_QUESTION_IDS,
]

/**
 * @typedef {{ state: object, questions: Record<string, object>, model?: string }} DecisionRequest
 * @typedef {{ answers: object, confidence: number, model?: string }} DecisionResponse
 */

export const DECISION_IO = '{ state, questions } → { answers, confidence }'
