import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  existsSync,
  readdirSync,
  appendFileSync,
} from 'node:fs'
import { join } from 'node:path'

export const PHASES = Object.freeze([
  'discovery',
  'research',
  'product_definition',
  'feasibility',
  'poc',
  'architecture',
  'planning',
  'implementation',
  'testing',
  'security',
  'performance',
  'product_validation',
  'release',
  'monitor',
])

export const GATES = Object.freeze([
  'problem_understood',
  'requirements_defined',
  'feasibility_proven',
  'architecture_validated',
  'implementation_complete',
  'tests_passing',
  'security_acceptable',
  'performance_acceptable',
  'product_validation_acceptable',
  'release_ready',
])

export function agentPaths(repoRoot) {
  const root = join(repoRoot, '.agent')
  return {
    root,
    state: join(root, 'state'),
    artifacts: join(root, 'artifacts'),
    run: join(root, 'state', 'run.json'),
    backlog: join(root, 'state', 'backlog.json'),
    events: join(root, 'events.jsonl'),
  }
}

export function ensureState(repoRoot, { goal } = {}) {
  const p = agentPaths(repoRoot)
  mkdirSync(p.state, { recursive: true })
  mkdirSync(p.artifacts, { recursive: true })

  const defaults = {
    'project-state.md': `# Project state\n\nMode: autonomous\nUpdated: ${new Date().toISOString()}\n`,
    'current-objective.md': `# Current objective\n\n${goal || 'Build and harden the local-first Mac AI control application.'}\n`,
    'backlog.md': `# Backlog\n\n(See also backlog.json)\n`,
    'decisions.md': `# Decisions\n\n`,
    'risks.md': `# Risks\n\n`,
    'blockers.md': `# Blockers\n\n`,
    'milestones.md': `# Milestones\n\n- M0: Autonomous OS + security core\n- M1: Product + architecture locks\n- M2: Capability expansion on Mac host\n`,
    'research.md': `# Research log\n\n`,
    'validation.md': `# Validation\n\n`,
  }
  for (const [name, body] of Object.entries(defaults)) {
    const fp = join(p.state, name)
    if (!existsSync(fp)) writeFileSync(fp, body)
  }
  if (goal) {
    writeFileSync(join(p.state, 'current-objective.md'), `# Current objective\n\n${goal}\n`)
  }
  if (!existsSync(p.backlog)) writeFileSync(p.backlog, '[]\n')
  if (!existsSync(p.run)) {
    writeFileSync(
      p.run,
      JSON.stringify(
        {
          version: 1,
          runId: `run_${Date.now().toString(16)}`,
          status: 'idle',
          phase: 'discovery',
          cycle: 0,
          maxCycles: 24,
          goal: goal || null,
          gates: Object.fromEntries(GATES.map((g) => [g, false])),
          activeWorkOrder: null,
          completed: [],
          stopReason: null,
          updatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    )
  } else if (goal) {
    const run = JSON.parse(readFileSync(p.run, 'utf8'))
    run.goal = goal
    writeFileSync(p.run, JSON.stringify(run, null, 2))
  }
  return p
}

export function loadRun(repoRoot) {
  const p = agentPaths(repoRoot)
  return JSON.parse(readFileSync(p.run, 'utf8'))
}

export function saveRun(repoRoot, run) {
  const p = agentPaths(repoRoot)
  run.updatedAt = new Date().toISOString()
  writeFileSync(p.run, JSON.stringify(run, null, 2))
}

export function loadBacklog(repoRoot) {
  const p = agentPaths(repoRoot)
  if (!existsSync(p.backlog)) return []
  return JSON.parse(readFileSync(p.backlog, 'utf8'))
}

export function saveBacklog(repoRoot, items) {
  const p = agentPaths(repoRoot)
  writeFileSync(p.backlog, JSON.stringify(items, null, 2) + '\n')
  const md = ['# Backlog', '']
  for (const it of items) {
    md.push(`## ${it.id} — ${it.title}`)
    md.push(`- Status: ${it.status}`)
    md.push(`- Priority: ${it.priority}`)
    md.push(`- Why: ${it.why}`)
    md.push(`- Owner: ${it.owner}`)
    md.push('')
  }
  writeFileSync(join(p.state, 'backlog.md'), md.join('\n'))
}

export function appendEvent(repoRoot, event) {
  const p = agentPaths(repoRoot)
  mkdirSync(p.root, { recursive: true })
  appendFileSync(p.events, JSON.stringify({ ...event, at: new Date().toISOString() }) + '\n')
}

export function inspectRepo(repoRoot) {
  const has = (rel) => existsSync(join(repoRoot, rel))
  const list = (rel) => (has(rel) ? readdirSync(join(repoRoot, rel)) : [])
  const appFiles = list('App')
  const pocFiles = list('docs/poc')
  return {
    hasPackageSwift: has('Package.swift'),
    hasSecurityMd: has('SECURITY.md'),
    hasArchitectureMd: has('ARCHITECTURE.md'),
    hasTechDecisions: has('TECHNOLOGY_DECISIONS.md'),
    hasProjectPlan: has('PROJECT_PLAN.md'),
    hasProductPrd: has('docs/product/PRD.md'),
    hasAcceptance: has('docs/product/acceptance-criteria.md'),
    hasAdr: list('docs/architecture').some((f) => f.startsWith('ADR-')),
    hasPocReport: pocFiles.some((f) => f.toUpperCase().includes('POC')),
    hasQaReport: list('docs/qa').length > 0,
    hasSecurityReport: list('docs/security').length > 0,
    hasPerfReport: list('docs/performance').length > 0,
    hasReleaseReadiness: has('docs/release/readiness.md'),
    hasValidation: has('.agent/state/validation.md') &&
      readFileSync(join(repoRoot, '.agent/state/validation.md'), 'utf8').includes('Against acceptance'),
    hasSwiftSources: has('Sources/MacAgentSecurity'),
    hasAutonomousCli: has('tools/autonomous/src/cli.js'),
    hasHostBlockers: has('docs/HOST_BLOCKERS.md'),
    /** True when the Director host is macOS (developer laptop / Mac CI). */
    isDarwin: process.platform === 'darwin',
    /** SwiftUI menu-bar shell present (not README-only placeholder). */
    hasMacAppShell:
      appFiles.some((f) => f.endsWith('.swift')) || has('Sources/MacAgentMenuBar/MacAgentMenuBarApp.swift'),
    /** Mac voice / STT+LLM feasibility report (distinct from Linux fast-path POC). */
    hasMacVoicePoc: pocFiles.some(
      (f) => /mac|voice|stt/i.test(f) && f.toUpperCase().includes('POC'),
    ),
    /** Hardened-runtime mic entitlement file (required for TCC listing). */
    hasMicEntitlements:
      has('Sources/MacAgentMenuBar/MacAgent.entitlements') &&
      readFileSync(join(repoRoot, 'Sources/MacAgentMenuBar/MacAgent.entitlements'), 'utf8').includes(
        'device.audio-input',
      ),
    /** Ollama tool-call bench evidence on this Mac. */
    hasOllamaPerf: list('docs/performance').some((f) => /ollama/i.test(f)),
    /** Personal local install path (no notarization). */
    hasPersonalInstallScript:
      has('scripts/package-macos-app.sh') &&
      readFileSync(join(repoRoot, 'scripts/package-macos-app.sh'), 'utf8').includes('--install'),
    /** M3 evidence that mic entitlement + personal install were verified. */
    hasM3InstallEvidence: has('docs/release/personal-install.md'),
    /** M4: live WhisperKit mic → runtime evidence on this Mac. */
    hasVoiceE2EEvidence: has('docs/poc/mac-voice-e2e.md'),
    /** M5: menu-bar UI polish notes. */
    hasMenuBarUIDoc: has('docs/ui/MENU_BAR.md'),
    /** M6: AX click/type journey evidence. */
    hasAXJourneyEvidence: has('docs/poc/mac-ax-journey.md'),
    /** M7 product slice: one-shot live arm. */
    hasConfirmToActSpec: has('docs/product/m7-confirm-to-act.md'),
    /** M7: menu bar exposes Act once. */
    hasActOnce:
      has('Sources/MacAgentMenuBar/MacAgentMenuBarApp.swift') &&
      readFileSync(join(repoRoot, 'Sources/MacAgentMenuBar/MacAgentMenuBarApp.swift'), 'utf8').includes(
        'Act once',
      ),
  }
}

export function writeStateMarkdown(repoRoot, name, body) {
  const p = agentPaths(repoRoot)
  writeFileSync(join(p.state, name), body.endsWith('\n') ? body : body + '\n')
}

export function appendStateSection(repoRoot, name, section) {
  const p = agentPaths(repoRoot)
  mkdirSync(p.state, { recursive: true })
  const fp = join(p.state, name)
  const prev = existsSync(fp) ? readFileSync(fp, 'utf8') : ''
  writeFileSync(fp, `${prev.trimEnd()}\n\n${section.trim()}\n`)
}
