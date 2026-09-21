/**
 * Work item schema + status machine for the company work pool.
 */

export const WORK_STATUSES = Object.freeze([
  'discovered',
  'proposed',
  'triaged',
  'ready',
  'claimed',
  'in_progress',
  'blocked',
  'review',
  'validation',
  'ready_to_merge',
  'completed',
  'rejected',
  'deferred',
  'abandoned',
  'stale',
  // legacy aliases kept for migration
  'candidate',
  'queued',
  'active',
  'in_review',
  'failed',
])

export const TERMINAL_STATUSES = Object.freeze([
  'completed',
  'rejected',
  'deferred',
  'abandoned',
  'failed',
])

export const CLAIMABLE_STATUSES = Object.freeze(['ready', 'queued', 'stale'])

export const ACTIVE_STATUSES = Object.freeze([
  'claimed',
  'in_progress',
  'active',
  'blocked',
  'review',
  'in_review',
  'validation',
  'ready_to_merge',
])

/** Map legacy statuses onto the v2 lifecycle. */
export function normalizeStatus(status) {
  const map = {
    candidate: 'discovered',
    queued: 'ready',
    active: 'in_progress',
    in_review: 'review',
    failed: 'abandoned',
  }
  return map[status] || status
}

export function isTerminal(status) {
  return TERMINAL_STATUSES.includes(normalizeStatus(status))
}

export function isClaimable(status) {
  return CLAIMABLE_STATUSES.includes(normalizeStatus(status)) || CLAIMABLE_STATUSES.includes(status)
}

export function isActiveWork(status) {
  return ACTIVE_STATUSES.includes(status) || ACTIVE_STATUSES.includes(normalizeStatus(status))
}

export function createWorkItem(input, { id, now } = {}) {
  const createdAt = now || new Date().toISOString()
  return {
    id,
    category: input.category,
    problemKey: input.problemKey,
    title: input.title,
    status: normalizeStatus(input.status || 'discovered'),
    department: input.department || departmentForCategory(input.category),
    problem: input.problem || input.title,
    desiredOutcome: input.desiredOutcome || input.impact || null,
    evidence: input.evidence || [],
    hypothesis: input.hypothesis || null,
    impact: input.impact || null,
    effort: input.effort || null,
    risks: input.risks || [],
    confidence: input.confidence ?? null,
    dependencies: input.dependencies || [],
    relatedWork: input.relatedWork || [],
    ownerRole: input.ownerRole || null,
    ownerWorkerId: input.ownerWorkerId || null,
    reviewerWorkerId: input.reviewerWorkerId || null,
    filesLikely: input.filesLikely || [],
    acceptanceCriteria: input.acceptanceCriteria || [],
    nonGoals: input.nonGoals || [],
    validationPlan: input.validationPlan || [],
    validationRequirements: input.validationRequirements || input.validationPlan || [],
    priority: input.priority || null,
    priorityRationale: input.priorityRationale || input.priority?.rationale || null,
    rejection: input.rejection || null,
    decisionHistory: input.decisionHistory || [],
    executionEvidence: input.executionEvidence || [],
    claim: null,
    parentId: input.parentId || null,
    origin: input.origin || 'discovery',
    roadmapId: input.roadmapId || null,
    workType: input.workType || null,
    skipDeliberation: input.skipDeliberation || false,
    blockReason: input.blockReason || null,
    createdAt: input.createdAt || createdAt,
    updatedAt: createdAt,
    attempts: input.attempts || 0,
    branch: input.branch || null,
  }
}

export function departmentForCategory(category) {
  const map = {
    product: 'product',
    ux: 'customer',
    bug: 'engineering',
    security: 'security',
    performance: 'engineering',
    tech_debt: 'debt',
    test_gap: 'qa',
    documentation: 'engineering',
    dx: 'devex',
    reliability: 'engineering',
    accessibility: 'customer',
    infrastructure: 'devex',
    research: 'research',
    unfinished: 'engineering',
    regression: 'qa',
    self_improvement: 'improve',
  }
  return map[category] || 'engineering'
}

export function pushDecision(item, decision) {
  const entry = {
    at: new Date().toISOString(),
    ...decision,
  }
  return {
    ...item,
    decisionHistory: [...(item.decisionHistory || []), entry],
    updatedAt: entry.at,
  }
}
