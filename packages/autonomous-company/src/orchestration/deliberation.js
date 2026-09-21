/**
 * Structured multi-perspective deliberation for significant proposals.
 */

import { nowIso, newId } from '../config.js'

export const SIGNIFICANT_CATEGORIES = Object.freeze([
  'product',
  'security',
  'self_improvement',
  'infrastructure',
  'research',
])

export function needsDeliberation(work) {
  if (work.skipDeliberation) return false
  if (work.origin?.startsWith('followup:') && work.category === 'documentation') return false
  return SIGNIFICANT_CATEGORIES.includes(work.category)
}

/**
 * Collect department perspectives. In OS tests these are deterministic.
 * Agents may enrich perspectives via artifacts; disagreement is preserved.
 */
export function deliberate(work, { perspectives } = {}) {
  const defaultPerspectives = perspectives || buildDefaultPerspectives(work)
  const votes = defaultPerspectives.map((p) => p.vote)
  const approve = votes.filter((v) => v === 'approve').length
  const reject = votes.filter((v) => v === 'reject').length
  const abstain = votes.filter((v) => v === 'abstain').length

  let decision = 'approve'
  let confidence = 0.55
  if (reject > approve) {
    decision = 'reject'
    confidence = 0.6
  } else if (approve === 0 && reject === 0) {
    decision = 'defer'
    confidence = 0.4
  } else if (reject > 0) {
    decision = 'approve_with_conditions'
    confidence = 0.5
  } else {
    confidence = Math.min(0.9, 0.5 + approve * 0.1)
  }

  return {
    id: newId('delib'),
    workId: work.id,
    at: nowIso(),
    perspectives: defaultPerspectives,
    decision,
    confidence,
    reasoning: summarizeReasoning(defaultPerspectives, decision),
    disagreement: defaultPerspectives.filter((p) => p.vote === 'reject' || p.concerns?.length),
  }
}

function buildDefaultPerspectives(work) {
  const evidenceWeak = !(work.evidence || []).some((e) =>
    ['verified', 'user_feedback'].includes(e.labeled),
  )
  return [
    {
      department: 'product',
      vote: work.category === 'self_improvement' && evidenceWeak ? 'abstain' : 'approve',
      rationale: 'Aligned with product mission if evidence holds',
      concerns: evidenceWeak ? ['Evidence mostly hypothesis'] : [],
    },
    {
      department: 'engineering',
      vote: (work.effort === 'XL' ? 'abstain' : 'approve'),
      rationale: 'Feasible if scoped to listed files',
      concerns: work.effort === 'XL' ? ['Effort XL — needs breakdown'] : [],
    },
    {
      department: 'security',
      vote: work.category === 'security' || /secret|ssrf|auth/i.test(work.title || '')
        ? 'approve'
        : 'abstain',
      rationale: 'Security-relevant work should proceed with review gates',
      concerns: [],
    },
    {
      department: 'architecture',
      vote: work.category === 'infrastructure' ? 'abstain' : 'approve',
      rationale: 'Prefer reversible changes; avoid speculative rewrites',
      concerns: work.category === 'infrastructure' ? ['Infra changes need explicit design'] : [],
    },
    {
      department: 'customer',
      vote: ['product', 'ux', 'accessibility'].includes(work.category) ? 'approve' : 'abstain',
      rationale: 'User-facing impact acknowledged',
      concerns: [],
    },
  ]
}

function summarizeReasoning(perspectives, decision) {
  const bits = perspectives.map((p) => `${p.department}:${p.vote}`)
  return `Decision=${decision} from [${bits.join(', ')}]`
}

export function applyDeliberationToWork(work, deliberation) {
  const history = [
    ...(work.decisionHistory || []),
    {
      at: deliberation.at,
      type: 'deliberation',
      decision: deliberation.decision,
      confidence: deliberation.confidence,
      deliberationId: deliberation.id,
    },
  ]
  if (deliberation.decision === 'reject') {
    return {
      ...work,
      status: 'rejected',
      rejection: {
        reasons: deliberation.disagreement.map((d) => d.rationale || d.department),
        at: deliberation.at,
      },
      decisionHistory: history,
    }
  }
  if (deliberation.decision === 'defer') {
    return { ...work, status: 'deferred', decisionHistory: history }
  }
  return {
    ...work,
    status: 'ready',
    confidence: deliberation.confidence,
    decisionHistory: history,
  }
}
