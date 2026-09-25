/**
 * Decision engine: pick highest-value next specialist action from evidence.
 * Foundation ladder first, then ready backlog items, then the slice catalog.
 * Idle only on an explicit user hold or when the catalog has nothing left to queue.
 */

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { inspectRepo, loadBacklog } from '../state/store.js'
import { SLICE_CATALOG } from './catalog.js'

export function decideNext(run, repoRoot) {
  if (run.userHold) {
    return {
      gates: { ...run.gates },
      phase: 'monitor',
      order: null,
      idle: true,
      stopReason: 'USER_HOLD',
    }
  }

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

  // M2 — Mac host capability expansion (developer laptop / Mac CI).
  if (snap.isDarwin && !snap.hasMacAppShell) {
    return {
      gates,
      phase: 'implementation',
      order: mk({
        skill: 'auto-engineer',
        title: 'Scaffold SwiftUI menu-bar app shell on Mac',
        why: 'M2: App/ is README-only; menu-bar UX required for product DoD',
        classification: 'KNOWN',
        mode: 'mac-app-shell',
        acceptance: ['App/*.swift menu-bar shell', 'swift test still green'],
      }),
    }
  }

  if (snap.isDarwin && !snap.hasMacVoicePoc) {
    return {
      gates,
      phase: 'poc',
      order: mk({
        skill: 'auto-poc',
        title: 'Mac voice pipeline POC (STT mock + runtime + Ollama probe)',
        why: 'M2: Linux fast-path POC does not prove Apple Silicon voice/LLM latency',
        classification: 'RISKY',
        mode: 'mac-voice',
        acceptance: ['docs/poc/mac-voice-POC_REPORT.md', 'honest NOT VERIFIED for missing deps'],
      }),
    }
  }

  if (snap.isDarwin && snap.hasMacAppShell && snap.hasMacVoicePoc && !run.completed?.includes('mac-m2-release')) {
    return {
      gates,
      phase: 'release',
      order: mk({
        skill: 'auto-release',
        title: 'Refresh release readiness for Mac host M2',
        why: 'Stale Linux-host release doc must reflect Mac laptop evidence',
        classification: 'KNOWN',
        mode: 'mac-m2',
        acceptance: ['docs/release/readiness.md updated for Darwin'],
        meta: { markCompleteKey: 'mac-m2-release' },
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

  if (snap.isDarwin && !run.completed?.includes('mac-m2-review')) {
    return {
      gates,
      phase: 'monitor',
      order: mk({
        skill: 'auto-review',
        title: 'M2 Mac host independent review',
        why: 'Critique App shell + Mac voice POC before declaring M2 idle',
        classification: 'KNOWN',
        mode: 'mac-m2',
        acceptance: ['.agent/artifacts/*/review.md'],
        meta: { markCompleteKey: 'mac-m2-review' },
      }),
    }
  }

  // M3 — personal laptop install hardening (mic TCC + stable sign + local .app).
  if (snap.isDarwin && (!snap.hasMicEntitlements || !snap.hasPersonalInstallScript)) {
    return {
      gates,
      phase: 'implementation',
      order: mk({
        skill: 'auto-engineer',
        title: 'Wire mic entitlement + personal install packaging',
        why: 'Hardened runtime without audio-input prevents Microphone TCC listing',
        classification: 'KNOWN',
        mode: 'mac-mic-install',
        acceptance: [
          'Sources/MacAgentMenuBar/MacAgent.entitlements',
          'scripts/package-macos-app.sh --install',
        ],
      }),
    }
  }

  if (snap.isDarwin && !snap.hasOllamaPerf) {
    return {
      gates,
      phase: 'performance',
      order: mk({
        skill: 'auto-perf',
        title: 'Benchmark Ollama tool-call latency on Mac',
        why: 'Product claims <2s local tool calls; need measured evidence',
        classification: 'KNOWN',
        mode: 'ollama',
        acceptance: ['docs/performance/*ollama*'],
      }),
    }
  }

  if (snap.isDarwin && !snap.hasM3InstallEvidence) {
    return {
      gates,
      phase: 'release',
      order: mk({
        skill: 'auto-release',
        title: 'Document personal Mac install + mic TCC DoD',
        why: 'Notarization out of scope; capture local install + entitlement evidence',
        classification: 'KNOWN',
        mode: 'mac-m3-personal',
        acceptance: ['docs/release/personal-install.md'],
        meta: { markCompleteKey: 'mac-m3-release' },
      }),
    }
  }

  if (snap.isDarwin && !run.completed?.includes('mac-m3-review')) {
    return {
      gates,
      phase: 'monitor',
      order: mk({
        skill: 'auto-review',
        title: 'M3 personal-install independent review',
        why: 'Confirm mic entitlement + local install path before idle',
        classification: 'KNOWN',
        mode: 'mac-m3',
        acceptance: ['.agent/artifacts/*/review.md'],
        meta: { markCompleteKey: 'mac-m3-review' },
      }),
    }
  }

  // M4 — WhisperKit mic → runtime E2E (user-verified on device).
  if (snap.isDarwin && !snap.hasVoiceE2EEvidence) {
    return {
      gates,
      phase: 'poc',
      order: mk({
        skill: 'auto-poc',
        title: 'Record WhisperKit mic→runtime E2E evidence',
        why: 'User confirmed Listen succeeded; persist measured evidence for DoD',
        classification: 'VALIDATED',
        mode: 'mac-voice-e2e',
        acceptance: ['docs/poc/mac-voice-e2e.md'],
      }),
    }
  }

  if (snap.isDarwin && snap.hasVoiceE2EEvidence && !run.completed?.includes('mac-m4-validation')) {
    return {
      gates,
      phase: 'product_validation',
      order: mk({
        skill: 'auto-product',
        title: 'Refresh product validation after voice E2E',
        why: 'Mic+WhisperKit path now user-verified',
        classification: 'KNOWN',
        mode: 'validation',
        meta: { markCompleteKey: 'mac-m4-validation' },
        acceptance: ['.agent/state/validation.md updated'],
      }),
    }
  }

  if (snap.isDarwin && !run.completed?.includes('mac-m4-review')) {
    return {
      gates,
      phase: 'monitor',
      order: mk({
        skill: 'auto-review',
        title: 'M4 voice E2E independent review',
        why: 'Close loop after WhisperKit Listen success',
        classification: 'KNOWN',
        mode: 'mac-m4',
        acceptance: ['.agent/artifacts/*/review.md'],
        meta: { markCompleteKey: 'mac-m4-review' },
      }),
    }
  }

  // M5 — menu-bar UI polish (ui-ux-pro-max).
  if (snap.isDarwin && !snap.hasMenuBarUIDoc) {
    return {
      gates,
      phase: 'implementation',
      order: mk({
        skill: 'auto-engineer',
        title: 'Polish menu-bar panel UX (status + primary Listen)',
        why: 'Dense button dump hurts primary Listen job; apply status feedback hierarchy',
        classification: 'KNOWN',
        mode: 'mac-ui-polish',
        acceptance: ['docs/ui/MENU_BAR.md', 'Sources/MacAgentMenuBar polished'],
      }),
    }
  }

  if (snap.isDarwin && snap.hasMenuBarUIDoc && !run.completed?.includes('mac-m5-review')) {
    return {
      gates,
      phase: 'monitor',
      order: mk({
        skill: 'auto-review',
        title: 'M5 menu-bar UI independent review',
        why: 'Confirm Listen-first hierarchy and a11y labels',
        classification: 'KNOWN',
        mode: 'mac-m5',
        acceptance: ['.agent/artifacts/*/review.md'],
        meta: { markCompleteKey: 'mac-m5-review' },
      }),
    }
  }

  // M6 — Accessibility click/type journeys.
  if (snap.isDarwin && !snap.hasAXJourneyEvidence) {
    return {
      gates,
      phase: 'poc',
      order: mk({
        skill: 'auto-poc',
        title: 'AX click/type journeys (TextEdit menu + type)',
        why: 'Prove Accessibility automation beyond dry-run stubs',
        classification: 'RISKY',
        mode: 'mac-ax-journey',
        acceptance: ['docs/poc/mac-ax-journey.md', 'Benchmarks/ax_journey.sh'],
      }),
    }
  }

  // M7 — one-shot "Act once" so dry-run stays the default and live is explicit.
  if (
    snap.isDarwin &&
    snap.hasAXJourneyEvidence &&
    !snap.hasConfirmToActSpec &&
    !run.completed?.includes('mac-m7-product')
  ) {
    return {
      gates,
      phase: 'product',
      order: mk({
        skill: 'auto-product',
        title: 'Define Act once (confirm-to-act) slice',
        why: 'Menu bar is dry-run only; users need an explicit one-shot live arm, not a sticky god mode',
        classification: 'KNOWN',
        mode: 'mac-m7-slice',
        acceptance: ['docs/product/m7-confirm-to-act.md'],
        meta: { markCompleteKey: 'mac-m7-product' },
      }),
    }
  }

  if (
    snap.isDarwin &&
    snap.hasConfirmToActSpec &&
    !run.completed?.includes('mac-m7-engineer')
  ) {
    return {
      gates,
      phase: 'implementation',
      order: mk({
        skill: 'auto-engineer',
        title: 'Ship Act once toggle on the menu bar',
        why: 'Default stays dry-run; the next Listen, Battery, Ollama, or AX journey can run live once',
        classification: 'KNOWN',
        mode: 'mac-m7-confirm',
        acceptance: ['Sources/MacAgentMenuBar Act once', 'VoicePipeline dryRun flag'],
        meta: { markCompleteKey: 'mac-m7-engineer' },
      }),
    }
  }

  if (
    snap.isDarwin &&
    run.completed?.includes('mac-m7-engineer') &&
    !run.completed?.includes('mac-m7-review')
  ) {
    return {
      gates,
      phase: 'monitor',
      order: mk({
        skill: 'auto-review',
        title: 'M7 Act once independent review',
        why: 'Confirm live is one-shot and dry-run remains the default',
        classification: 'KNOWN',
        mode: 'mac-m7',
        acceptance: ['.agent/artifacts/*/review.md'],
        meta: { markCompleteKey: 'mac-m7-review' },
      }),
    }
  }

  if (snap.isDarwin && snap.hasAXJourneyEvidence && !run.completed?.includes('mac-m6-review')) {
    return {
      gates,
      phase: 'monitor',
      order: mk({
        skill: 'auto-review',
        title: 'M6 AX journeys independent review',
        why: 'Close loop after Accessibility click/type evidence',
        classification: 'KNOWN',
        mode: 'mac-m6',
        acceptance: ['.agent/artifacts/*/review.md'],
        meta: { markCompleteKey: 'mac-m6-review' },
      }),
    }
  }

  return scheduleContinuous(run, repoRoot, gates, mk)
}

function scheduleContinuous(run, repoRoot, gates, mk) {
  if (run.userHold) {
    return {
      gates,
      phase: 'monitor',
      order: null,
      idle: true,
      stopReason: 'USER_HOLD',
    }
  }

  let items = []
  try {
    items = loadBacklog(repoRoot)
  } catch {
    items = []
  }
  const ready = items.find(
    (it) =>
      (it.status === 'ready' || it.status === 'open') &&
      it.skill &&
      !run.completed?.includes(it.id),
  )
  if (ready) {
    return {
      gates,
      phase: ready.skill === 'auto-product' ? 'product' : 'implementation',
      order: mk({
        skill: ready.skill,
        title: ready.title,
        why: ready.why,
        classification: ready.risk || 'KNOWN',
        mode: ready.mode,
        acceptance: ready.acceptance || [],
        meta: { markCompleteKey: ready.id, backlogId: ready.id },
      }),
    }
  }

  const next = SLICE_CATALOG.find(
    (slice) => !existsSync(join(repoRoot, slice.evidence)) && !run.completed?.includes(slice.id),
  )
  if (next) {
    return {
      gates,
      phase: 'product',
      order: mk({
        skill: 'auto-product',
        title: `Queue ${next.title}`,
        why: next.why,
        classification: 'KNOWN',
        mode: 'plan-next',
        acceptance: [`backlog item ${next.id}`],
        meta: { sliceId: next.id, markCompleteKey: `queued-${next.id}` },
      }),
    }
  }

  return {
    gates,
    phase: 'monitor',
    order: null,
    idle: true,
    stopReason: 'AWAITING_USER_GUIDANCE',
  }
}
