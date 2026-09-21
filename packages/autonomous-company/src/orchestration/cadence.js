/**
 * Cadence-gated departmental activities (not every tick).
 */

export const CADENCES = Object.freeze({
  continuous_discovery: { everyCycles: 1 },
  strategy_review: { everyCycles: 5 },
  technology_review: { everyCycles: 5 },
  tech_debt_review: { everyCycles: 3 },
  retrospective: { everyCycles: 4 },
  self_improvement_review: { everyCycles: 4 },
})

export function dueCadences(cycleNumber, lastRan = {}) {
  const due = []
  for (const [name, spec] of Object.entries(CADENCES)) {
    const last = lastRan[name] || 0
    if (cycleNumber - last >= spec.everyCycles || cycleNumber === 1) {
      due.push(name)
    }
  }
  return due
}

/**
 * Deterministic departmental discovery snippets for cadence ticks.
 * Returns candidate descriptors (still must pass triage).
 */
export function cadenceDiscoveries(cadenceName, { repoSignals = [] } = {}) {
  switch (cadenceName) {
    case 'tech_debt_review':
      return repoSignals
        .filter((s) => s.kind === 'todo' || s.kind === 'duplication')
        .map((s) => ({
          category: 'tech_debt',
          problemKey: `cadence:debt:${s.path}`,
          title: `Tech-debt review: ${s.path}`,
          department: 'debt',
          origin: 'cadence:tech_debt_review',
          evidence: [{ type: 'repository', path: s.path, note: s.note, labeled: s.labeled || 'hypothesis' }],
          impact: s.impact || 'Maintainability risk',
          effort: 'M',
          ownerRole: 'debt',
          filesLikely: [s.path],
          acceptanceCriteria: ['Debt justified with impact or rejected'],
        }))
    case 'technology_review':
      return [
        {
          category: 'research',
          problemKey: 'cadence:tech:stack-watch',
          title: 'Periodic technology watch for planner/LLM stack',
          department: 'research',
          origin: 'cadence:technology_review',
          evidence: [
            {
              type: 'cadence',
              path: 'packages/core/src/planner.js',
              note: 'Scheduled research cadence — requires primary sources before action',
              labeled: 'hypothesis',
            },
          ],
          impact: 'Avoid stale tooling assumptions',
          effort: 'S',
          ownerRole: 'research',
          filesLikely: ['packages/core/src/planner.js'],
          acceptanceCriteria: ['Research record with adopt/experiment/monitor/reject'],
        },
      ]
    case 'retrospective':
      return [
        {
          category: 'self_improvement',
          problemKey: 'cadence:retro:process',
          title: 'Organizational retrospective: value vs waste',
          department: 'improve',
          origin: 'cadence:retrospective',
          evidence: [
            {
              type: 'cadence',
              path: '.autonomous-company/events',
              note: 'Review recent completions/rejections for process waste',
              labeled: 'hypothesis',
            },
          ],
          impact: 'Improve operating quality',
          effort: 'S',
          ownerRole: 'improve',
          acceptanceCriteria: ['Retro notes + optional improvement proposal or explicit no-op'],
        },
      ]
    case 'self_improvement_review':
      return []
    case 'strategy_review':
      return []
    default:
      return []
  }
}

export function markCadencesRan(lastRan, due, cycleNumber) {
  const next = { ...lastRan }
  for (const name of due) next[name] = cycleNumber
  return next
}
