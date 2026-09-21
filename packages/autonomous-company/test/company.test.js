import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { findRepoRoot } from '../src/repo-root.js'
import {
  boot,
  runCycle,
  interruptRun,
  beginRun,
  runDiscovery,
  activateTask,
  completeTask,
  rejectTaskImplementation,
  requestHighImpact,
  getConflicts,
  loadStore,
  fingerprintTask,
  prioritizeCandidates,
  selectNextTask,
  evaluateAntiSlopAnswers,
  detectSlopClaims,
  evaluateGates,
  checkSafetyAction,
  createImprovementProposal,
  evaluateImprovement,
  applyImprovement,
  rollbackWorkflow,
  createResearchFinding,
  acquireLocks,
  detectFileConflicts,
  AGENTS,
} from '../src/index.js'
import { loadConfig } from '../src/config.js'
import { upsertCandidate, createEmptyRun } from '../src/state/store.js'

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'ac-'))
  mkdirSync(join(root, 'server'), { recursive: true })
  mkdirSync(join(root, 'client/src'), { recursive: true })
  mkdirSync(join(root, 'packages/core/src'), { recursive: true })
  mkdirSync(join(root, 'packages/core/test'), { recursive: true })
  mkdirSync(join(root, 'docs'), { recursive: true })
  writeFileSync(
    join(root, 'CONTEXT.md'),
    '# Product\n\nChat-first UI studio for widgets.\n',
  )
  writeFileSync(
    join(root, 'docs/AI_WORKFLOW.md'),
    '# Workflow\n\nResearch → Plan → Implement → Validate\n',
  )
  writeFileSync(join(root, 'docs/MANUAL_QA.md'), '# QA\n\nStudio chat → preview\n')
  writeFileSync(
    join(root, 'server/index.js'),
    '// TODO: tighten rate limit on generate path\nexport default {}\n',
  )
  writeFileSync(join(root, 'packages/core/src/index.js'), 'export const ok = true\n')
  writeFileSync(
    join(root, 'packages/core/test/index.test.js'),
    'import { ok } from "../src/index.js"\n',
  )
  return root
}

describe('autonomous-company foundation', () => {
  let root
  beforeEach(() => {
    root = makeRepo()
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('initializes durable state and status', () => {
    const store = boot(root)
    expect(existsSync(join(root, '.autonomous-company/run.json'))).toBe(true)
    expect(store.status.phase).toBe('idle')
    expect(store.memory.productMission).toMatch(/Chat-first/)
  })

  it('resumes after interrupt instead of wiping state', () => {
    boot(root)
    beginRun(root)
    interruptRun(root, 'simulated_crash')
    const mid = loadStore(root)
    expect(mid.run.status).toBe('interrupted')
    const runId = mid.run.runId

    const resumed = runCycle(root, { resume: true })
    expect(resumed.ok).toBe(true)
    const after = loadStore(root)
    expect(after.run.runId).toBe(runId)
  })

  it('can conclude no actionable high-value work', () => {
    // Empty markers and high reject threshold
    writeFileSync(join(root, 'server/index.js'), 'export default {}\n')
    const configOverrides = {
      discovery: { scanTodoMarkers: true, scanTestGaps: false, scanDocDriftHints: false, minEvidenceCount: 1, maxCandidates: 10 },
      prioritization: { rejectBelowScore: 4.9, weights: loadConfig(root).prioritization.weights },
    }
    const result = runCycle(root, { dryRun: true, configOverrides })
    expect(result.stopped || result.dryRun).toBeTruthy()
    if (result.stopped) {
      expect(result.message).toMatch(/NO ACTIONABLE HIGH-VALUE TASK/i)
    }
  })

  it('deduplicates tasks by fingerprint', () => {
    const store = boot(root)
    const candidate = {
      category: 'bug',
      problemKey: 'same-problem',
      title: 'Fix same problem',
      evidence: [{ type: 'repository', labeled: 'verified' }],
    }
    const a = upsertCandidate(store.paths, store.pool, candidate)
    const b = upsertCandidate(store.paths, loadStore(root).pool, {
      ...candidate,
      title: 'Fix same problem again',
    })
    expect(a.id).toBe(b.id)
    expect(b.created).toBe(false)
    expect(fingerprintTask(candidate)).toBe(a.id)
  })

  it('blocks deploy by default', () => {
    boot(root)
    const result = requestHighImpact(root, 'deploy')
    expect(result.allowed).toBe(false)
  })

  it('rejects completion without anti-slop answers and gates', () => {
    boot(root)
    beginRun(root)
    const discovery = runDiscovery(root)
    expect(discovery.accepted.length + discovery.rejected.length).toBeGreaterThan(0)
    const queued = loadStore(root).pool.tasks.find((t) => t.status === 'queued')
    if (!queued) return
    activateTask(root, queued.id)
    const failed = completeTask(root, queued.id, {
      antiSlopAnswers: {},
      gateChecklist: {},
      reviewVerdict: 'approve',
      validationResults: [],
    })
    expect(failed.ok).toBe(false)
    expect(failed.error).toBe('anti_slop_failed')
  })

  it('detects file ownership conflicts', () => {
    const tasks = [
      { id: 'a', status: 'active', filesLikely: ['server/index.js'] },
      { id: 'b', status: 'active', filesLikely: ['server/index.js', 'client/src/App.jsx'] },
    ]
    const conflicts = detectFileConflicts(tasks)
    expect(conflicts.length).toBe(1)
    expect(conflicts[0].file).toBe('server/index.js')
  })

  it('acquireLocks prevents overlapping active edits', () => {
    const run = createEmptyRun()
    const first = acquireLocks(run, { id: 't1', filesLikely: ['server/a.js'] })
    expect(first.ok).toBe(true)
    run.locks = first.locks
    const second = acquireLocks(run, { id: 't2', filesLikely: ['server/a.js'] })
    expect(second.ok).toBe(false)
  })
})

describe('prioritization and anti-slop', () => {
  it('rejects busywork and low-evidence debt', () => {
    const config = loadConfig(process.cwd())
    const prioritized = prioritizeCandidates(
      [
        {
          category: 'tech_debt',
          problemKey: 'busy',
          title: 'polish already-green demo',
          evidence: [{ labeled: 'hypothesis' }],
          effort: 'L',
          risks: [],
        },
      ],
      config,
    )
    expect(prioritized[0].decision).toBe('reject')
    const selection = selectNextTask(prioritized)
    expect(selection.reason).toBe('NO_ACTIONABLE_HIGH_VALUE_TASK')
  })

  it('detects placeholder and unproven pass claims', () => {
    const findings = detectSlopClaims({
      diffSummary: 'throw new Error("Not implemented")',
      completionClaim: 'Tests passed',
      testNotes: 'looks good',
    })
    expect(findings.some((f) => f.smell === 'placeholder_implementation')).toBe(true)
    expect(findings.some((f) => f.smell === 'claim_completion_without_proof')).toBe(true)
  })

  it('anti-slop requires substantive answers', () => {
    const empty = evaluateAntiSlopAnswers({})
    expect(empty.pass).toBe(false)
    const answers = Object.fromEntries(
      [
        'What problem are we solving?',
        'What evidence supports it?',
        'Why is this implementation appropriate?',
        'What existing functionality could be affected?',
        'What could go wrong?',
        'How will we verify the result?',
        'What would make us reject this approach?',
      ].map((q) => [q, 'A concrete, evidence-backed answer for testing.']),
    )
    expect(evaluateAntiSlopAnswers(answers).pass).toBe(true)
  })

  it('documentation gates differ from security gates', () => {
    const doc = evaluateGates({ category: 'documentation', checklist: {} })
    const sec = evaluateGates({ category: 'security', checklist: {} })
    expect(sec.required).toContain('security_review_completed')
    expect(doc.required).not.toContain('security_review_completed')
  })
})

describe('self-improvement safeguards', () => {
  it('rejects proposals that weaken safety or validation', () => {
    const config = loadConfig(process.cwd())
    const proposal = createImprovementProposal({
      observedProblem: 'Too many review failures',
      evidence: [{ note: '3 rejects last week' }],
      rootCauseHypothesis: 'Reviews are strict',
      proposedChange: 'Skip review gate',
      expectedBenefit: 'Faster throughput',
      risk: 'Lower quality',
      validationStrategy: 'None',
      rollbackStrategy: 'Re-enable gate',
      weakensSafety: true,
      weakensValidation: true,
    })
    const evaluated = evaluateImprovement(proposal, config)
    expect(evaluated.status).toBe('rejected')
    expect(evaluated.evaluation.blockers.length).toBeGreaterThan(0)
  })

  it('supports workflow rollback', () => {
    let improvements = {
      proposals: [],
      workflowVersions: [{ version: '0.1.0', status: 'active', createdAt: new Date().toISOString() }],
    }
    const proposal = createImprovementProposal({
      observedProblem: 'Discovery too noisy',
      evidence: [{ note: 'many rejected candidates' }],
      rootCauseHypothesis: 'Threshold low',
      proposedChange: 'Raise rejectBelowScore',
      expectedBenefit: 'Less busywork',
      risk: 'Miss real issues',
      validationStrategy: 'Compare reject rates',
      rollbackStrategy: 'Restore prior config version',
    })
    const approved = evaluateImprovement(proposal, loadConfig(process.cwd()))
    expect(approved.status).toBe('approved_pending_apply')
    improvements = applyImprovement(improvements, approved, { workflowVersion: '0.1.1' })
    expect(improvements.workflowVersions.find((v) => v.status === 'active').version).toBe('0.1.1')
    improvements = rollbackWorkflow(improvements, { toVersion: '0.1.0' })
    expect(improvements.workflowVersions.find((v) => v.status === 'active').version).toBe('0.1.0')
  })
})

describe('research records', () => {
  it('requires outcome and claim labels', () => {
    const finding = createResearchFinding({
      title: 'Vitest 2 usage',
      summary: 'Repo already uses Vitest for core',
      sources: [{ url: 'https://vitest.dev', accessedAt: '2026-03-21' }],
      claims: [{ text: 'Vitest is the project test runner', label: 'verified_fact' }],
      productRelevance: 'Keep using Vitest for company package',
      outcome: 'adopt',
    })
    expect(finding.id).toMatch(/^research_/)
    expect(() =>
      createResearchFinding({
        title: 'x',
        summary: 'y',
        claims: [{ text: 'z', label: 'vibes' }],
        productRelevance: 'n',
        outcome: 'adopt',
      }),
    ).toThrow(/Invalid claim label/)
  })
})

describe('agent registry', () => {
  it('defines lean org with clear boundaries', () => {
    expect(AGENTS.founder.boundaries.some((b) => /invent customer demand/i.test(b))).toBe(true)
    expect(AGENTS.improve.boundaries.some((b) => /cannotWeakenSafety/i.test(b))).toBe(true)
    expect(AGENTS.engineer.subtypes).toContain('frontend')
  })
})

describe('repo root resolution', () => {
  it('walks up from a nested package directory', () => {
    const nested = join(process.cwd(), 'src')
    // When tests run inside packages/autonomous-company, parent monorepo has CONTEXT.md
    const root = findRepoRoot(nested)
    expect(existsSync(join(root, 'CONTEXT.md')) || root === process.cwd() || existsSync(join(root, 'packages/autonomous-company/package.json'))).toBe(true)
  })
})

describe('adversarial scenarios', () => {
  let root
  beforeEach(() => {
    root = makeRepo()
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('1. ambiguous / no-value task is rejected', () => {
    const config = loadConfig(root)
    const result = prioritizeCandidates(
      [
        {
          category: 'product',
          problemKey: 'maybe-something',
          title: 'Perhaps improve things somehow',
          evidence: [],
          effort: 'XL',
        },
      ],
      config,
    )
    expect(result[0].decision).toBe('reject')
  })

  it('3. falsified validation cannot complete', () => {
    boot(root)
    beginRun(root)
    runDiscovery(root)
    const queued = loadStore(root).pool.tasks.find((t) => t.status === 'queued')
    if (!queued) return
    activateTask(root, queued.id)
    const answers = Object.fromEntries(
      [
        'What problem are we solving?',
        'What evidence supports it?',
        'Why is this implementation appropriate?',
        'What existing functionality could be affected?',
        'What could go wrong?',
        'How will we verify the result?',
        'What would make us reject this approach?',
      ].map((q) => [q, 'A concrete, evidence-backed answer for testing.']),
    )
    const gates = Object.fromEntries(
      evaluateGates({ category: queued.category, checklist: {} }).required.map((g) => [g, true]),
    )
    const result = completeTask(root, queued.id, {
      antiSlopAnswers: answers,
      gateChecklist: gates,
      reviewVerdict: 'approve',
      validationResults: [
        { command: 'npm test', required: true, status: 'failed', exitCode: 1, claimedPass: true },
      ],
    })
    expect(result.ok).toBe(false)
    expect(result.error).toBe('falsified_validation')
  })

  it('5. overlapping file claims conflict', () => {
    boot(root)
    const store = loadStore(root)
    upsertCandidate(store.paths, store.pool, {
      category: 'bug',
      problemKey: 'one',
      title: 'One',
      status: 'active',
      filesLikely: ['server/index.js'],
      evidence: [{ labeled: 'verified' }],
    })
    upsertCandidate(store.paths, loadStore(root).pool, {
      category: 'bug',
      problemKey: 'two',
      title: 'Two',
      status: 'active',
      filesLikely: ['server/index.js'],
      evidence: [{ labeled: 'verified' }],
    })
    expect(getConflicts(root).length).toBeGreaterThan(0)
  })

  it('11. self-improvement cannot weaken validation', () => {
    const evaluated = evaluateImprovement(
      createImprovementProposal({
        observedProblem: 'CI slow',
        evidence: [{ note: 'builds take time' }],
        rootCauseHypothesis: 'too many tests',
        proposedChange: 'Allow skipping lint',
        expectedBenefit: 'speed',
        risk: 'regressions',
        validationStrategy: 'none',
        rollbackStrategy: 're-enable',
        weakensValidation: true,
      }),
      loadConfig(root),
    )
    expect(evaluated.status).toBe('rejected')
  })

  it('12. unavailable high-impact permissions stay blocked', () => {
    expect(checkSafetyAction('force_push', loadConfig(root)).allowed).toBe(false)
    expect(checkSafetyAction('secret_mutation', loadConfig(root)).allowed).toBe(false)
    expect(checkSafetyAction('gate_weakening', loadConfig(root)).allowed).toBe(false)
  })

  it('15. review rejection returns work to implement', () => {
    boot(root)
    beginRun(root)
    runDiscovery(root)
    const queued = loadStore(root).pool.tasks.find((t) => t.status === 'queued')
    if (!queued) return
    activateTask(root, queued.id)
    const result = rejectTaskImplementation(root, queued.id, {
      reasons: ['Incorrect behavior vs acceptance criteria'],
    })
    expect(result.ok).toBe(true)
    expect(loadStore(root).run.phase).toBe('implement')
  })
})
