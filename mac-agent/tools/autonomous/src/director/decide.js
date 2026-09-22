/**
 * Decision engine: pick highest-value next specialist action from evidence.
 * Not a rigid pipeline — may jump backward when gates fail.
 */

import { inspectRepo } from '../state/store.js'

export function decideNext(run, repoRoot) {
  const snap = inspectRepo(repoRoot)
  const gates = { ...run.gates }

  // Derive gate truth from repository evidence (source of truth).
  gates.problem_understood = snap.hasProjectPlan || snap.hasProductPrd
  gates.requirements_defined = Boolean(snap.hasAcceptance && snap.hasProductPrd)
  gates.feasibility_proven = Boolean(snap.hasPocReport)
  gates.architecture_validated = Boolean(snap.hasArchitectureMd && snap.hasSecurityMd && snap.hasAdr)
  gates.implementation_complete = Boolean(snap.hasSwiftSources)
  if (snap.hasQaReport) gates.tests_passing = true
  if (snap.hasSecurityReport) gates.security_acceptable = true
  if (snap.hasPerfReport) gates.performance_acceptable = true
  if (snap.hasValidation) gates.product_validation_acceptable = true
  if (snap.hasReleaseReadiness) gates.release_ready = true

  const mk = (partial) => ({
    ...partial,
    id: `wo_${Date.now().toString(16)}_${Math.random().toString(16).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  })

  // Highest-risk unknown first.
  if (!snap.hasTechDecisions) {
    return {
      gates,
      phase: 'research',
      order: mk({
        skill: 'auto-research',
        title: 'Research local Mac control stack',
        why: 'Technology choices not yet locked with evidence',
        classification: 'UNKNOWN',
        acceptance: ['docs/research/stack-comparison.md', 'TECHNOLOGY_DECISIONS.md exists or updated'],
      }),
    }
  }

  if (!snap.hasProductPrd || !snap.hasAcceptance) {
    return {
      gates,
      phase: 'product_definition',
      order: mk({
        skill: 'auto-product',
        title: 'Define MVP PRD and acceptance criteria',
        why: 'Cannot implement safely without problem/MVP/acceptance',
        classification: 'KNOWN',
        acceptance: ['docs/product/PRD.md', 'docs/product/acceptance-criteria.md'],
      }),
    }
  }

  if (!snap.hasPocReport) {
    return {
      gates,
      phase: 'poc',
      order: mk({
        skill: 'auto-poc',
        title: 'POC / host feasibility for STT+LLM latency claims',
        why: 'Latency claims are risky; need measured or honestly blocked POC',
        classification: 'RISKY',
        acceptance: ['docs/poc/*POC_REPORT.md'],
      }),
    }
  }

  if (!snap.hasAdr || !snap.hasArchitectureMd) {
    return {
      gates,
      phase: 'architecture',
      order: mk({
        skill: 'auto-architect',
        title: 'Lock architecture ADRs for security invariant + LLM provider',
        why: 'Irreversible boundaries must be ADR-backed before more features',
        classification: 'KNOWN',
        acceptance: ['docs/architecture/ADR-001-security-invariant.md'],
      }),
    }
  }

  if (!snap.hasSwiftSources) {
    return {
      gates,
      phase: 'implementation',
      order: mk({
        skill: 'auto-engineer',
        title: 'Implement security-critical AgentCore foundation',
        why: 'No Swift sources present',
        classification: 'KNOWN',
        acceptance: ['Sources/MacAgentSecurity exists', 'swift test green or NOT VERIFIED'],
      }),
    }
  }

  if (!snap.hasQaReport || !gates.tests_passing) {
    return {
      gates,
      phase: 'testing',
      order: mk({
        skill: 'auto-qa',
        title: 'Run unit/integration suite and record QA report',
        why: 'Implementation exists but QA evidence gate open',
        classification: 'KNOWN',
        acceptance: ['docs/qa/*-report.md', 'test commands + exit codes'],
      }),
    }
  }

  if (!snap.hasSecurityReport || !gates.security_acceptable) {
    return {
      gates,
      phase: 'security',
      order: mk({
        skill: 'auto-security',
        title: 'Adversarial security audit of policy/sandbox',
        why: 'Security must be independent of implementer',
        classification: 'RISKY',
        acceptance: ['docs/security/*-report.md'],
      }),
    }
  }

  if (!snap.hasPerfReport || !gates.performance_acceptable) {
    return {
      gates,
      phase: 'performance',
      order: mk({
        skill: 'auto-perf',
        title: 'Benchmark deterministic fast path',
        why: 'Product claims near-instant commands; need numbers',
        classification: 'KNOWN',
        acceptance: ['docs/performance/*-bench.md'],
      }),
    }
  }

  if (!gates.product_validation_acceptable) {
    return {
      gates,
      phase: 'product_validation',
      order: mk({
        skill: 'auto-product',
        title: 'Product validation against acceptance criteria',
        why: 'Technical green ≠ product success',
        classification: 'KNOWN',
        mode: 'validation',
        acceptance: ['.agent/state/validation.md updated'],
      }),
    }
  }

  if (!snap.hasReleaseReadiness || !gates.release_ready) {
    return {
      gates,
      phase: 'release',
      order: mk({
        skill: 'auto-release',
        title: 'Release readiness vs Definition of Done',
        why: 'Assess what can ship vs Mac-host blockers',
        classification: 'KNOWN',
        acceptance: ['docs/release/readiness.md'],
      }),
    }
  }

  // Monitor / next iteration: independent review then idle if nothing critical.
  if (!run.completed?.includes('post-release-review')) {
    return {
      gates,
      phase: 'monitor',
      order: mk({
        skill: 'auto-review',
        title: 'Post-milestone independent review',
        why: 'Close the loop with critique before idle',
        classification: 'KNOWN',
        acceptance: ['.agent/artifacts/*/review.md'],
        meta: { markCompleteKey: 'post-release-review' },
      }),
    }
  }

  return {
    gates,
    phase: 'monitor',
    order: null,
    idle: true,
    stopReason: 'NO_ACTIONABLE_HIGH_VALUE_TASK',
  }
}
