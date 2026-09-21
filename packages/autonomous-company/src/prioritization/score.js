/**
 * Multi-factor prioritization with explicit rationale.
 * Scores are decision aids, not objective truth.
 */

const EFFORT_MAP = { S: 5, M: 3, L: 1, XL: 0 }

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n))
}

function factorFromEvidence(candidate) {
  const labels = (candidate.evidence || []).map((e) => e.labeled)
  if (labels.includes('verified')) return 4
  if (labels.includes('user_feedback')) return 5
  if (labels.includes('hypothesis')) return 2
  return 2
}

function securityBoost(candidate) {
  if (candidate.category === 'security') return 5
  const text = `${candidate.title} ${candidate.impact || ''}`.toLowerCase()
  if (/(secret|ssrf|auth|xss|inject|rce|credential)/.test(text)) return 4
  return 1
}

function userValueGuess(candidate) {
  if (['product', 'ux', 'bug', 'accessibility', 'reliability'].includes(candidate.category)) {
    return 4
  }
  if (candidate.category === 'documentation') return 2
  if (candidate.category === 'tech_debt') return 2
  if (candidate.category === 'test_gap') return 3
  if (candidate.category === 'research') return 2
  return 3
}

export function scoreCandidate(candidate, weights) {
  const factors = {
    userValue: userValueGuess(candidate),
    productRelevance: candidate.category === 'product' ? 5 : 3,
    severity: candidate.category === 'bug' ? 4 : 2,
    securityRisk: securityBoost(candidate),
    reliabilityImpact: candidate.category === 'reliability' ? 5 : 2,
    technicalRisk: candidate.risks?.length ? 3 : 2,
    effortInverse: EFFORT_MAP[candidate.effort] ?? 3,
    confidence: factorFromEvidence(candidate),
    reversibility: candidate.category === 'infrastructure' ? 2 : 4,
  }

  let score = 0
  let weightSum = 0
  const parts = []
  for (const [key, value] of Object.entries(factors)) {
    const w = weights[key] ?? 1
    score += value * w
    weightSum += w
    parts.push(`${key}=${value}×${w}`)
  }
  const normalized = clamp(score / weightSum, 0, 5)

  return {
    score: Number(normalized.toFixed(3)),
    factors,
    rationale: `Weighted factors: ${parts.join('; ')}. Score is a decision aid, not objective truth.`,
  }
}

/**
 * Challenge weak work before execution.
 */
export function challengeCandidate(candidate, priority, config) {
  const reasons = []

  if (!candidate.evidence?.length) {
    reasons.push('No evidence attached')
  }
  if (
    candidate.evidence?.every((e) => e.labeled === 'hypothesis') &&
    !candidate.hypothesis
  ) {
    reasons.push('Hypothesis-only evidence without explicit hypothesis statement')
  }
  if (priority.score < config.prioritization.rejectBelowScore) {
    reasons.push(
      `Score ${priority.score} below reject threshold ${config.prioritization.rejectBelowScore}`,
    )
  }
  if (/polish already-green|random feature|keep the loop busy/i.test(candidate.title)) {
    reasons.push('Title suggests busywork')
  }
  if (candidate.category === 'tech_debt' && priority.factors.userValue < 3 && priority.factors.severity < 3) {
    reasons.push('Low-severity tech debt without clear user/reliability payoff')
  }
  if (candidate.category === 'test_gap' && candidate.evidence?.some((e) => e.labeled === 'hypothesis')) {
    // Not automatic reject — but must be challenged
    if (priority.score < 3.2) {
      reasons.push('Heuristic test-gap with modest score — prefer real failure evidence')
    }
  }

  const reject = reasons.length > 0 && (
    priority.score < config.prioritization.rejectBelowScore ||
    reasons.some((r) => r.includes('No evidence') || r.includes('busywork'))
  )

  return {
    accept: !reject,
    reasons,
    challengeNotes: reasons.length
      ? reasons
      : ['No blocking challenges; still require proposal for significant work'],
  }
}

export function prioritizeCandidates(candidates, config) {
  const results = []
  for (const candidate of candidates) {
    const priority = scoreCandidate(candidate, config.prioritization.weights)
    const challenge = challengeCandidate(candidate, priority, config)
    results.push({
      candidate,
      priority,
      challenge,
      decision: challenge.accept ? 'queue' : 'reject',
    })
  }
  results.sort((a, b) => b.priority.score - a.priority.score)
  return results
}

export function selectNextTask(prioritized) {
  const accepted = prioritized.filter((p) => p.decision === 'queue')
  if (!accepted.length) {
    return {
      task: null,
      reason: 'NO_ACTIONABLE_HIGH_VALUE_TASK',
      message: 'NO ACTIONABLE HIGH-VALUE TASK IDENTIFIED.',
    }
  }
  return {
    task: accepted[0],
    reason: 'highest_justified_score',
    message: `Selected: ${accepted[0].candidate.title}`,
  }
}
