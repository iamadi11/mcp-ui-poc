import { nowIso, newId } from '../config.js'

/**
 * Controlled self-improvement — versioned, independently evaluable, rollbackable.
 */

export function createImprovementProposal({
  observedProblem,
  evidence = [],
  rootCauseHypothesis,
  proposedChange,
  expectedBenefit,
  risk,
  validationStrategy,
  rollbackStrategy,
  weakensSafety = false,
  weakensValidation = false,
}) {
  return {
    id: newId('improve'),
    status: 'proposed',
    observedProblem,
    evidence,
    rootCauseHypothesis,
    proposedChange,
    expectedBenefit,
    risk,
    validationStrategy,
    rollbackStrategy,
    weakensSafety,
    weakensValidation,
    createdAt: nowIso(),
    evaluation: null,
  }
}

export function evaluateImprovement(proposal, config) {
  const blockers = []
  if (proposal.weakensSafety && config.selfImprovement?.cannotWeakenSafety !== false) {
    blockers.push('Proposal weakens safety mechanisms — rejected by policy')
  }
  if (proposal.weakensValidation) {
    blockers.push('Proposal weakens validation — rejected by default')
  }
  if (!proposal.evidence?.length) {
    blockers.push('No evidence for observed problem')
  }
  if (!proposal.rollbackStrategy) {
    blockers.push('Missing rollback strategy')
  }
  if (!proposal.validationStrategy) {
    blockers.push('Missing validation strategy')
  }

  const evaluation = {
    at: nowIso(),
    accept: blockers.length === 0,
    blockers,
    note:
      blockers.length === 0
        ? 'Eligible for controlled adoption after independent review'
        : 'Rejected or needs revision',
  }
  return { ...proposal, status: evaluation.accept ? 'approved_pending_apply' : 'rejected', evaluation }
}

export function applyImprovement(improvements, proposal, { workflowVersion }) {
  const versions = [...(improvements.workflowVersions || [])]
  const previous = versions.find((v) => v.status === 'active')
  if (previous) previous.status = 'superseded'
  versions.push({
    version: workflowVersion,
    status: 'active',
    createdAt: nowIso(),
    fromProposal: proposal.id,
    rollbackTo: previous?.version || null,
  })
  const proposals = (improvements.proposals || []).map((p) =>
    p.id === proposal.id ? { ...proposal, status: 'applied', appliedAt: nowIso() } : p,
  )
  return {
    ...improvements,
    proposals,
    workflowVersions: versions,
    updatedAt: nowIso(),
  }
}

export function rollbackWorkflow(improvements, { toVersion }) {
  const versions = [...(improvements.workflowVersions || [])]
  const target = versions.find((v) => v.version === toVersion)
  if (!target) {
    throw new Error(`Unknown workflow version: ${toVersion}`)
  }
  for (const v of versions) {
    if (v.status === 'active') v.status = 'rolled_back'
  }
  target.status = 'active'
  target.restoredAt = nowIso()
  return { ...improvements, workflowVersions: versions, updatedAt: nowIso() }
}

export function concludeNoImprovement() {
  return {
    status: 'no_improvement_justified',
    message: 'No process improvement is currently justified.',
    at: nowIso(),
  }
}
