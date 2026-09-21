import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  startCompany,
  tickCompany,
  bootCompany,
  completeWorkItem,
  loadStore,
  upsertCandidate,
  recoverStaleClaims,
  createDefaultWorkers,
  deliberate,
  applyDeliberationToWork,
  proposeFollowUps,
  claimWorkForWorker,
  releaseWorker,
  listTasks,
  saveWorkers,
  saveTask,
  normalizeStatus,
} from '../src/index.js'
import { loadConfig } from '../src/config.js'

function makeRepo() {
  const root = mkdtempSync(join(tmpdir(), 'ac-os-'))
  mkdirSync(join(root, 'server'), { recursive: true })
  mkdirSync(join(root, 'client/src'), { recursive: true })
  mkdirSync(join(root, 'packages/core/src'), { recursive: true })
  mkdirSync(join(root, 'packages/core/test'), { recursive: true })
  mkdirSync(join(root, 'docs'), { recursive: true })
  writeFileSync(join(root, 'CONTEXT.md'), '# Product\n\nChat-first UI studio for widgets.\n')
  writeFileSync(join(root, 'docs/AI_WORKFLOW.md'), '# Workflow\n\nResearch → Plan → Implement → Validate\n')
  writeFileSync(join(root, 'docs/MANUAL_QA.md'), '# QA\n\nStudio chat → preview\n')
  writeFileSync(
    join(root, 'server/index.js'),
    '// TODO: harden auth session binding\nexport default {}\n',
  )
  writeFileSync(join(root, 'packages/core/src/index.js'), 'export const ok = true\n')
  writeFileSync(join(root, 'packages/core/test/index.test.js'), 'import { ok } from "../src/index.js"\n')
  return root
}

function approvalReport(summary = 'done') {
  return {
    summary,
    antiSlopAnswers: Object.fromEntries(
      [
        'What problem are we solving?',
        'What evidence supports it?',
        'Why is this implementation appropriate?',
        'What existing functionality could be affected?',
        'What could go wrong?',
        'How will we verify the result?',
        'What would make us reject this approach?',
      ].map((q) => [q, `Detailed answer for: ${q} (${summary})`]),
    ),
    gateChecklist: {
      requirements_understood: true,
      existing_implementation_inspected: true,
      no_unresolved_critical_issues: true,
      completion_evidence_available: true,
      implementation_completed: true,
      tests_added_or_updated: true,
      relevant_validation_executed: true,
      results_recorded: true,
      independent_review_completed: true,
      security_review_completed: true,
      documentation_updated_if_needed: true,
    },
    reviewVerdict: 'approve',
    validationResults: [
      {
        command: 'npm test --workspace=ui-compose-kit',
        required: true,
        status: 'passed',
        exitCode: 0,
        claimedPass: true,
        outputExcerpt: 'ok',
      },
    ],
  }
}

describe('company OS — multi-cycle autonomy', () => {
  let root
  beforeEach(() => {
    root = makeRepo()
  })
  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('starts with one command and keeps running after a task completes', () => {
    bootCompany(root, {
      configOverrides: {
        execution: {
          maxCycles: 10,
          maxConcurrentTasks: 3,
          defaultTicksPerStart: 2,
          stopWhenNoHighValueWork: false,
        },
        prioritization: { rejectBelowScore: 1.0, weights: loadConfig(root).prioritization.weights },
      },
    })

    const store = loadStore(root)
    // Seed verified high-value work
    upsertCandidate(store.paths, store.pool, {
      category: 'bug',
      problemKey: 'os:bug:auth-session',
      title: 'Harden auth session binding',
      status: 'ready',
      evidence: [{ type: 'repository', path: 'server/index.js', note: 'TODO auth', labeled: 'verified' }],
      impact: 'Session fixation risk',
      effort: 'S',
      ownerRole: 'engineer',
      filesLikely: ['server/index.js'],
      acceptanceCriteria: ['Session binding hardened + test'],
      validationPlan: ['npm test'],
      priority: { score: 4.5, rationale: 'verified security-adjacent bug' },
    })

    const started = startCompany(root, {
      ticks: 1,
      fresh: true,
      configOverrides: {
        execution: { maxCycles: 10, maxConcurrentTasks: 3, stopWhenNoHighValueWork: false },
        prioritization: { rejectBelowScore: 1.0, weights: loadConfig(root).prioritization.weights },
      },
    })
    expect(started.message).toBe('Company started.')
    expect(started.workOrders.length).toBeGreaterThanOrEqual(1)

    const taskId = started.workOrders[0].taskId
    const completed = completeWorkItem(root, taskId, approvalReport('auth hardened'))
    expect(completed.ok).toBe(true)
    expect(completed.companyContinues).toBe(true)

    const afterComplete = loadStore(root)
    expect(afterComplete.run.mode).not.toBe('stopped')
    expect(afterComplete.run.status).toBe('running')

    // Company continues on next tick (critical acceptance test)
    const tick2 = tickCompany(root, {
      configOverrides: {
        execution: { maxCycles: 10, stopWhenNoHighValueWork: false },
        prioritization: { rejectBelowScore: 1.0, weights: loadConfig(root).prioritization.weights },
      },
    })
    expect(tick2.stopped).not.toBe(true)
    expect(tick2.cycle).toBeGreaterThan(1)
    // Follow-ups may be ready from completion
    const poolStatuses = afterComplete.pool.tasks.map((t) => normalizeStatus(t.status))
    expect(poolStatuses).toContain('completed')
  })

  it('recovers stale worker claims back to ready', () => {
    bootCompany(root)
    const store = loadStore(root)
    const up = upsertCandidate(store.paths, store.pool, {
      category: 'bug',
      problemKey: 'os:stale:1',
      title: 'Stale claim fixture',
      status: 'ready',
      evidence: [{ type: 'repository', path: 'server/index.js', labeled: 'verified' }],
      impact: 'x',
      effort: 'S',
      filesLikely: ['server/index.js'],
      acceptanceCriteria: ['done'],
      priority: { score: 4 },
    })
    const task = listTasks(store.paths).find((t) => t.id === up.id)
    const roster = createDefaultWorkers({ leaseMs: 1 })
    const eng = roster.workers.find((w) => w.department === 'engineering')
    claimWorkForWorker(roster, eng, task, { leaseMs: 1 })
    task.status = 'in_progress'
    // Force expired lease
    eng.leaseExpiresAt = new Date(Date.now() - 1000).toISOString()
    task.claim.leaseExpiresAt = eng.leaseExpiresAt
    saveTask(store.paths, task)
    saveWorkers(store.paths, roster)

    const recovered = recoverStaleClaims(roster, [task], { now: Date.now() })
    expect(recovered.length).toBe(1)
    expect(task.status).toBe('stale')
    expect(eng.status).toBe('idle')
  })

  it('deliberates significant work and can reject', () => {
    const work = {
      id: 'x',
      category: 'self_improvement',
      title: 'Weaken all gates for speed',
      evidence: [{ labeled: 'hypothesis' }],
      effort: 'XL',
    }
    const delib = deliberate(work, {
      perspectives: [
        { department: 'product', vote: 'reject', rationale: 'Dangerous', concerns: ['safety'] },
        { department: 'engineering', vote: 'reject', rationale: 'No', concerns: [] },
        { department: 'security', vote: 'reject', rationale: 'Blocks', concerns: [] },
        { department: 'architecture', vote: 'reject', rationale: 'No', concerns: [] },
        { department: 'customer', vote: 'abstain', rationale: '-', concerns: [] },
      ],
    })
    expect(delib.decision).toBe('reject')
    const after = applyDeliberationToWork(work, delib)
    expect(after.status).toBe('rejected')
  })

  it('proposes follow-ups after completion without fabricating metrics', () => {
    const followUps = proposeFollowUps(
      {
        id: 't1',
        problemKey: 'p1',
        title: 'Fix SSRF',
        category: 'security',
        filesLikely: ['server/data-source.js'],
      },
      { summary: 'fixed' },
    )
    expect(followUps.length).toBeGreaterThan(0)
    expect(followUps.every((f) => f.parentId === 't1')).toBe(true)
    expect(followUps.every((f) => f.origin === 'followup')).toBe(true)
  })

  it('does not chain follow-ups from follow-up completions', () => {
    const nested = proposeFollowUps(
      {
        id: 't2',
        problemKey: 'followup:sec-review:p1',
        title: 'Security residual review: Fix SSRF',
        category: 'security',
        origin: 'followup',
        filesLikely: ['server/data-source.js', 'sanitize-spec.js'],
      },
      { summary: 'reviewed' },
    )
    expect(nested).toEqual([])
  })

  it('enters idle/monitoring when no high-value work remains', () => {
    writeFileSync(join(root, 'server/index.js'), 'export default {}\n')
    const result = startCompany(root, {
      ticks: 3,
      fresh: true,
      configOverrides: {
        discovery: {
          scanTodoMarkers: true,
          scanTestGaps: false,
          scanDocDriftHints: false,
          minEvidenceCount: 1,
          maxCandidates: 10,
        },
        prioritization: {
          rejectBelowScore: 4.9,
          weights: loadConfig(root).prioritization.weights,
        },
        execution: { maxCycles: 5, defaultTicksPerStart: 3, stopWhenNoHighValueWork: true },
      },
    })
    const idleOrEmpty = result.results.some((r) => r.idle) || result.workOrders.length === 0
    expect(idleOrEmpty).toBe(true)
    const store = loadStore(root)
    expect(['idle_monitoring', 'autonomous', 'stopped']).toContain(store.run.mode)
  })

  it('supports concurrent claims up to maxConcurrentTasks', () => {
    const overrides = {
      execution: { maxConcurrentTasks: 2, stopWhenNoHighValueWork: false, maxCycles: 5 },
      prioritization: { rejectBelowScore: 1, weights: loadConfig(root).prioritization.weights },
    }
    bootCompany(root, { configOverrides: overrides })
    // Ensure company is running so tick assigns work
    startCompany(root, { ticks: 0, fresh: true, configOverrides: overrides })
    const store = loadStore(root, { configOverrides: overrides })
    for (const i of [1, 2, 3]) {
      upsertCandidate(store.paths, store.pool, {
        category: 'bug',
        problemKey: `os:conc:${i}`,
        title: `Concurrent bug ${i}`,
        status: 'ready',
        evidence: [{ type: 'repository', path: `server/f${i}.js`, labeled: 'verified' }],
        impact: 'x',
        effort: 'S',
        filesLikely: [`server/f${i}.js`],
        acceptanceCriteria: ['done'],
        priority: { score: 4 },
        ownerRole: 'engineer',
      })
      writeFileSync(join(root, `server/f${i}.js`), `export const n=${i}\n`)
    }
    const tick = tickCompany(root, { configOverrides: overrides })
    expect(tick.workOrders?.length).toBeLessThanOrEqual(2)
    expect(tick.workOrders?.length).toBeGreaterThanOrEqual(1)
    const busy = loadStore(root).workers.workers.filter((w) => w.status === 'busy')
    expect(busy.length).toBe(tick.workOrders.length)
  })

  it('releases workers back to idle after completion', () => {
    bootCompany(root)
    const store = loadStore(root)
    const roster = store.workers
    const eng = roster.workers.find((w) => w.id === 'worker_engineering')
    const up = upsertCandidate(store.paths, store.pool, {
      category: 'bug',
      problemKey: 'os:release:1',
      title: 'Release worker fixture',
      status: 'ready',
      evidence: [{ type: 'repository', path: 'server/index.js', labeled: 'verified' }],
      impact: 'x',
      effort: 'S',
      filesLikely: ['server/auth.js'],
      acceptanceCriteria: ['done'],
      priority: { score: 4.2 },
    })
    writeFileSync(join(root, 'server/auth.js'), 'export default {}\n')
    const task = listTasks(store.paths).find((t) => t.id === up.id)
    claimWorkForWorker(roster, eng, task)
    task.status = 'in_progress'
    saveTask(store.paths, task)
    saveWorkers(store.paths, roster)

    const done = completeWorkItem(root, task.id, approvalReport('released'))
    expect(done.ok).toBe(true)
    const after = loadStore(root)
    const w = after.workers.workers.find((x) => x.id === 'worker_engineering')
    expect(w.status).toBe('idle')
    expect(w.currentWorkId).toBeNull()
  })

  it('discovers open GitHub issues and skips resolved + non-actionable ones', async () => {
    const { discoverOpenIssues, resolvedIssueNumbersFromPool, discoverCandidates } = await import(
      '../src/discovery/engine.js'
    )
    bootCompany(root)
    const store = loadStore(root)
    upsertCandidate(store.paths, store.pool, {
      category: 'bug',
      problemKey: 'github:issue:42',
      title: 'Already done (#42)',
      status: 'completed',
      evidence: [{ labeled: 'verified' }],
      priority: { score: 4 },
    })
    const fresh = loadStore(root)
    const resolved = resolvedIssueNumbersFromPool(fresh)
    expect(resolved.has(42)).toBe(true)

    const found = discoverOpenIssues(root, fresh, {
      listIssues: () => [
        {
          number: 42,
          title: 'Already done',
          body: '**Severity:** High\n### Fix\nDo it',
        },
        {
          number: 99,
          title: 'SSRF still broken somewhere',
          body: '**Severity:** High\n### Fix\nHarden redirects',
        },
        { number: 1, title: 'looks cool!', body: 'nice' },
      ],
    })
    expect(found.map((c) => c.problemKey)).toEqual(['github:issue:99'])
    expect(found[0].category).toBe('security')

    const scanned = discoverCandidates(
      root,
      fresh,
      {
        discovery: {
          scanTodoMarkers: false,
          scanTestGaps: false,
          scanDocDriftHints: false,
          includeOpenIssues: true,
          maxCandidates: 10,
          minEvidenceCount: 1,
        },
      },
      {
        listIssues: () => [
          {
            number: 99,
            title: 'SSRF still broken somewhere',
            body: '**Severity:** High\n### Fix\nx',
          },
        ],
      },
    )
    expect(scanned.candidates.some((c) => c.problemKey === 'github:issue:99')).toBe(true)
  })
})
