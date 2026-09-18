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

export const MOTION_TOKENS = ['none', 'enter', 'stagger', 'live']

export const NAMED_WIDGET_CHOICES = [
  'none',
  'table',
  'chart',
  'list',
  'stat-grid',
  'key-value',
]

export const ROUTING_QUESTION_IDS = [
  'intent',
  'surface',
  'named_widget',
  'chart_type',
  'density',
  'needs_fetch',
  'needs_motion',
  'needs_llm',
  'in_catalog',
  'motion',
]

/**
 * @typedef {{ state: object, questions: Record<string, object>, model?: string }} DecisionRequest
 * @typedef {{ answers: object, confidence: number, model?: string }} DecisionResponse
 */

export const DECISION_IO = '{ state, questions } → { answers, confidence }'
