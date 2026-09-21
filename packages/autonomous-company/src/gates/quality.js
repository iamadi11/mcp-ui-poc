/**
 * Category-specific quality gates and safety policy checks.
 */

export function gatesForCategory(category) {
  const base = [
    'requirements_understood',
    'existing_implementation_inspected',
    'no_unresolved_critical_issues',
    'completion_evidence_available',
  ]
  const byCat = {
    documentation: [...base, 'documentation_updated'],
    tech_debt: [...base, 'implementation_completed', 'relevant_validation_executed', 'results_recorded'],
    test_gap: [...base, 'tests_added_or_updated', 'relevant_validation_executed', 'results_recorded'],
    bug: [
      ...base,
      'implementation_completed',
      'tests_added_or_updated',
      'relevant_validation_executed',
      'results_recorded',
      'independent_review_completed',
    ],
    security: [
      ...base,
      'implementation_completed',
      'tests_added_or_updated',
      'relevant_validation_executed',
      'results_recorded',
      'independent_review_completed',
      'security_review_completed',
    ],
    product: [
      ...base,
      'implementation_completed',
      'tests_added_or_updated',
      'relevant_validation_executed',
      'results_recorded',
      'independent_review_completed',
      'documentation_updated_if_needed',
    ],
    ux: [
      ...base,
      'implementation_completed',
      'relevant_validation_executed',
      'results_recorded',
      'independent_review_completed',
      'journey_or_browser_evidence',
    ],
    self_improvement: [
      ...base,
      'independent_review_completed',
      'rollback_strategy_defined',
      'does_not_weaken_safety',
    ],
  }
  return byCat[category] || [
    ...base,
    'implementation_completed',
    'relevant_validation_executed',
    'results_recorded',
    'independent_review_completed',
  ]
}

export function evaluateGates({ category, checklist = {} }) {
  const required = gatesForCategory(category)
  const missing = required.filter((g) => checklist[g] !== true)
  return {
    pass: missing.length === 0,
    required,
    missing,
    satisfied: required.filter((g) => checklist[g] === true),
  }
}

export const HIGH_IMPACT_ACTIONS = Object.freeze([
  'deploy',
  'force_push',
  'secret_mutation',
  'production_infra_change',
  'gate_weakening',
  'major_dependency_bump',
  'irreversible_data_migration',
])

export function checkSafetyAction(action, config, { approvedArtifactId = null } = {}) {
  const safety = config.safety || {}
  const map = {
    deploy: safety.allowDeploy,
    force_push: safety.allowForcePush,
    secret_mutation: safety.allowSecretMutation,
    production_infra_change: safety.allowProductionInfraChange,
    gate_weakening: safety.allowGateWeakening,
    major_dependency_bump: false,
    irreversible_data_migration: false,
  }
  if (!(action in map)) {
    return { allowed: false, reason: `Unknown high-impact action: ${action}` }
  }
  if (map[action] === true) {
    return { allowed: true, reason: 'Explicitly allowed in config' }
  }
  if (safety.highImpactRequiresArtifactApproval && approvedArtifactId) {
    return {
      allowed: false,
      reason:
        'Artifact approval recorded but action remains blocked by default safety policy until config allow-list is updated by a human',
      approvedArtifactId,
    }
  }
  return {
    allowed: false,
    reason: `Action "${action}" blocked by safety policy (default deny)`,
  }
}

/**
 * Map repo validation commands by touch set.
 */
export function suggestedValidationCommands({ files = [], category } = {}) {
  const cmds = []
  const touchedClient = files.some((f) => f.startsWith('client/'))
  const touchedCore = files.some((f) => f.startsWith('packages/core/'))
  const touchedCompany = files.some((f) => f.startsWith('packages/autonomous-company/'))
  if (touchedCore) cmds.push({ command: 'npm test --workspace=ui-compose-kit', required: true })
  if (touchedCompany) cmds.push({ command: 'npm run company:test', required: true })
  if (touchedClient) cmds.push({ command: 'npm run lint --prefix client', required: true })
  if (touchedClient || category === 'ux' || category === 'product') {
    cmds.push({ command: 'npm run build', required: false })
    cmds.push({
      command: 'browser journey per docs/MANUAL_QA.md',
      required: category === 'ux' || category === 'product',
      type: 'manual_or_mcp',
    })
  }
  if (!cmds.length) {
    cmds.push({ command: 'npm test --workspace=ui-compose-kit', required: false })
  }
  return cmds
}

export function recordValidationResult({ command, exitCode, outputExcerpt = '', skipped = false }) {
  if (skipped) {
    return {
      command,
      status: 'skipped',
      exitCode: null,
      outputExcerpt,
      claimedPass: false,
      note: 'Skipped — must not be treated as pass',
    }
  }
  return {
    command,
    status: exitCode === 0 ? 'passed' : 'failed',
    exitCode,
    outputExcerpt: String(outputExcerpt).slice(0, 2000),
    claimedPass: exitCode === 0,
  }
}
