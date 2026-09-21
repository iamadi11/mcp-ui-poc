/**
 * Company clock — autonomous operating loop.
 * Completing a task does NOT stop the company.
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { nowIso } from '../config.js'
import {
  appendEvent,
  initStore,
  loadStore,
  loadTask,
  savePool,
  saveRun,
  saveMemory,
  saveTask,
  saveWorkers,
  upsertCandidate,
  listTasks,
} from '../state/store.js'
import { discoverCandidates } from '../discovery/engine.js'
import { prioritizeCandidates } from '../prioritization/score.js'
import {
  seedMemoryFromRepoDocs,
  consolidateMemory,
  recordRejection,
  recordDecision,
} from '../memory/project.js'
import { formatStatus, renderCompanyDashboard } from '../observability/status.js'
import { acquireLocks, releaseLocks } from './conflict.js'
import {
  createDefaultWorkers,
  idleWorkers,
  recoverStaleClaims,
  claimWorkForWorker,
  releaseWorker,
  workerCanTake,
} from '../workers/roster.js'
import { normalizeStatus, isClaimable, isActiveWork } from '../work/schema.js'
import { dueCadences, cadenceDiscoveries, markCadencesRan } from './cadence.js'
import { needsDeliberation, deliberate, applyDeliberationToWork } from './deliberation.js'
import { proposeFollowUps, buildProductFeedback } from './followups.js'
import { concludeNoImprovement } from '../improve/proposals.js'
import { agentsForPhase, routeEngineerSubtype } from '../agents/registry.js'
import { evaluateAntiSlopAnswers } from '../anti-slop/protocol.js'
import { evaluateGates, checkSafetyAction } from '../gates/quality.js'

function ensureWorkers(store) {
  if (store.workers?.workers?.length) return store.workers
  const roster = createDefaultWorkers({
    leaseMs: store.config.execution.claimLeaseMs || 30 * 60_000,
  })
  saveWorkers(store.paths, roster)
  return roster
}

function budgetExceeded(run, config) {
  const maxCycles = config.execution.maxCycles || config.execution.maxIterations || 12
  if ((run.cycle || 0) >= maxCycles) return 'max_cycles'
  if (run.wallDeadlineAt && Date.now() > Date.parse(run.wallDeadlineAt)) return 'max_wall_time'
  return null
}

function poolCounts(pool) {
  const counts = {
    ready: 0,
    in_progress: 0,
    review: 0,
    blocked: 0,
    completed: 0,
    rejected: 0,
    discovered: 0,
  }
  for (const t of pool.tasks) {
    const s = normalizeStatus(t.status)
    if (s === 'ready' || s === 'stale') counts.ready += 1
    else if (s === 'blocked') counts.blocked += 1
    else if (s === 'review' || s === 'validation') counts.review += 1
    else if (s === 'completed') counts.completed += 1
    else if (s === 'rejected') counts.rejected += 1
    else if (s === 'discovered' || s === 'proposed' || s === 'triaged') counts.discovered += 1
    else if (isActiveWork(s)) counts.in_progress += 1
  }
  return counts
}

function syncPoolSummary(paths, pool, task) {
  const idx = pool.tasks.findIndex((t) => t.id === task.id)
  const summary = {
    id: task.id,
    category: task.category,
    title: task.title,
    status: task.status,
    priorityScore: task.priority?.score ?? null,
    department: task.department || null,
    updatedAt: nowIso(),
  }
  if (idx >= 0) pool.tasks[idx] = summary
  else pool.tasks.push(summary)
  savePool(paths, pool)
}

function writeDeliberation(paths, delib) {
  const dir = join(paths.root, 'deliberations')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${delib.id}.json`), `${JSON.stringify(delib, null, 2)}\n`)
}

function touchDocs(repoRoot) {
  const contextPath = join(repoRoot, 'CONTEXT.md')
  return {
    contextExcerpt: existsSync(contextPath)
      ? readFileSync(contextPath, 'utf8').slice(0, 800)
      : '',
    workflowNote: 'Follow docs/AI_WORKFLOW.md',
  }
}

export function bootCompany(repoRoot, options = {}) {
  initStore(repoRoot, options)
  const store = loadStore(repoRoot, options)
  ensureWorkers(store)
  store.memory = seedMemoryFromRepoDocs(store.memory, touchDocs(repoRoot))
  store.memory = consolidateMemory(store.memory)
  saveMemory(store.paths, store.memory)
  appendEvent(store.paths, { type: 'company_boot', runId: store.run.runId })
  return { ...loadStore(repoRoot, options), status: formatStatus(loadStore(repoRoot, options)) }
}

function enterStop(repoRoot, reason, options) {
  const store = loadStore(repoRoot, options)
  store.run.status = 'stopped'
  store.run.mode = 'stopped'
  store.run.phase = 'idle'
  store.run.stopReason = reason
  saveRun(store.paths, store.run)
  appendEvent(store.paths, { type: 'company_stopped', runId: store.run.runId, reason })
  const fresh = loadStore(repoRoot, options)
  return {
    ok: true,
    stopped: true,
    reason,
    status: formatStatus(fresh),
    dashboard: renderCompanyDashboard(fresh),
  }
}

export function startCompany(repoRoot, options = {}) {
  bootCompany(repoRoot, options)
  const store = loadStore(repoRoot, options)
  const { config, paths, run } = store
  ensureWorkers(store)

  const resumable =
    (run.status === 'running' || run.status === 'interrupted' || run.mode === 'idle_monitoring')
    && options.fresh !== true

  if (resumable && options.resume !== false) {
    appendEvent(paths, { type: 'company_resume', runId: run.runId, cycle: run.cycle })
    run.status = 'running'
    run.mode = 'autonomous'
    saveRun(paths, run)
  } else {
    run.status = 'running'
    run.mode = 'autonomous'
    run.phase = 'operating'
    run.cycle = 0
    run.iteration = 0
    run.startedAt = nowIso()
    run.wallDeadlineAt = new Date(Date.now() + config.execution.maxWallTimeMs).toISOString()
    run.stopReason = null
    run.lastError = null
    run.cadences = {}
    run.workOrders = []
    run.activeTaskId = null
    saveRun(paths, run)
    appendEvent(paths, { type: 'company_started', runId: run.runId })
  }

  const maxTicks = options.ticks === 0 ? 0 : (options.ticks ?? config.execution.defaultTicksPerStart ?? 8)
  const results = []
  for (let i = 0; i < maxTicks; i += 1) {
    const tick = tickCompany(repoRoot, options)
    results.push(tick)
    if (tick.stopped || tick.idle) break
  }
  const fresh = loadStore(repoRoot, options)
  return {
    ok: true,
    message: 'Company started.',
    ticks: results.length,
    results,
    status: formatStatus(fresh),
    dashboard: renderCompanyDashboard(fresh),
    workOrders: fresh.run.workOrders || [],
  }
}

export function tickCompany(repoRoot, options = {}) {
  const store = loadStore(repoRoot, options)
  const { config, paths } = store
  let { run } = store
  let roster = ensureWorkers(store)
  let pool = store.pool

  if (run.status === 'stopped' || run.mode === 'stopped') {
    return {
      ok: true,
      stopped: true,
      reason: run.stopReason || 'not_running',
      status: formatStatus(store),
      dashboard: renderCompanyDashboard(store),
    }
  }

  // Idle monitoring: still tick discovery lightly
  if (run.mode === 'idle_monitoring') {
    run.status = 'running'
    run.mode = 'autonomous'
  }

  const exceeded = budgetExceeded(run, config)
  if (exceeded) return enterStop(repoRoot, exceeded, options)

  run.cycle = (run.cycle || 0) + 1
  run.iteration = run.cycle
  run.phase = 'operating'
  run.workOrders = []

  // 1) Recover stale claims
  const allTasks = listTasks(paths)
  const recovered = recoverStaleClaims(roster, allTasks)
  for (const t of allTasks) saveTask(paths, t)
  saveWorkers(paths, roster)
  if (recovered.length) {
    appendEvent(paths, { type: 'stale_recovered', runId: run.runId, recovered })
    for (const r of recovered) {
      const task = loadTask(paths, r.workId)
      if (task && task.status === 'stale') {
        task.status = 'ready'
        saveTask(paths, task)
        syncPoolSummary(paths, pool, task)
      }
    }
  }

  // 2) Discovery + cadences
  const due = dueCadences(run.cycle, run.cadences || {})
  const discovery = discoverCandidates(repoRoot, { ...store, pool }, config)
  const cadenceCandidates = []
  for (const name of due) {
    if (name === 'continuous_discovery') continue
    const signals = (discovery.candidates || []).map((c) => ({
      kind: c.category === 'tech_debt' ? 'todo' : 'other',
      path: c.filesLikely?.[0] || c.problemKey,
      note: c.title,
      labeled: c.evidence?.[0]?.labeled,
      impact: c.impact,
    }))
    cadenceCandidates.push(...cadenceDiscoveries(name, { repoSignals: signals }))
  }
  run.cadences = markCadencesRan(run.cadences || {}, due, run.cycle)

  const combined = [...(discovery.candidates || []), ...cadenceCandidates]
  const prioritized = prioritizeCandidates(combined, config)
  let accepted = 0
  let rejected = 0
  for (const item of prioritized) {
    if (item.decision === 'queue') {
      const up = upsertCandidate(paths, pool, {
        ...item.candidate,
        status: 'discovered',
        priority: item.priority,
        priorityRationale: item.priority?.rationale,
      })
      const saved = loadTask(paths, up.id)
      if (!saved) continue
      if (needsDeliberation(saved) && normalizeStatus(saved.status) === 'discovered') {
        const delib = deliberate(saved)
        const after = applyDeliberationToWork(saved, delib)
        saveTask(paths, after)
        syncPoolSummary(paths, pool, after)
        writeDeliberation(paths, delib)
        if (after.status === 'ready') accepted += 1
        else rejected += 1
      } else {
        saved.status = 'ready'
        saveTask(paths, saved)
        syncPoolSummary(paths, pool, saved)
        accepted += 1
      }
    } else {
      upsertCandidate(paths, pool, {
        ...item.candidate,
        status: 'rejected',
        priority: item.priority,
        rejection: { reasons: item.challenge.reasons, at: nowIso() },
      })
      recordRejection(store.memory, {
        idea: item.candidate.title,
        reason: item.challenge.reasons.join('; '),
      })
      rejected += 1
    }
  }
  saveMemory(paths, store.memory)

  // reload pool after upserts
  pool = loadStore(repoRoot, options).pool
  roster = loadStore(repoRoot, options).workers || roster

  // 3) Assign workers concurrently
  const maxConcurrent = config.execution.maxConcurrentTasks || 3
  let busy = roster.workers.filter((w) => w.status === 'busy').length
  const ready = pool.tasks
    .map((s) => loadTask(paths, s.id))
    .filter((t) => t && isClaimable(t.status))
    .sort(
      (a, b) =>
        (b.priority?.score || b.priorityScore || 0) - (a.priority?.score || a.priorityScore || 0),
    )

  const workOrders = []
  for (const work of ready) {
    if (busy >= maxConcurrent) break
    const candidateWorkers = idleWorkers(roster).filter((w) => workerCanTake(w, work))
    if (!candidateWorkers.length) continue
    candidateWorkers.sort((a, b) => (a.completedCount || 0) - (b.completedCount || 0))
    const worker = candidateWorkers[0]

    if (shouldDeclineWork(worker, work)) {
      work.decisionHistory = [
        ...(work.decisionHistory || []),
        {
          at: nowIso(),
          type: 'worker_decline',
          workerId: worker.id,
          reason: 'Poor role fit or speculative cadence-only evidence',
        },
      ]
      saveTask(paths, work)
      continue
    }

    const lockResult = acquireLocks(run, work)
    if (!lockResult.ok) {
      work.status = 'blocked'
      saveTask(paths, work)
      syncPoolSummary(paths, pool, work)
      continue
    }
    run.locks = lockResult.locks
    claimWorkForWorker(roster, worker, work, { leaseMs: config.execution.claimLeaseMs })
    work.status = 'in_progress'
    work.engineerSubtype = routeEngineerSubtype(work)
    saveTask(paths, work)
    syncPoolSummary(paths, pool, work)
    busy += 1
    workOrders.push(buildWorkOrder(work, worker))

    if (options.autoSimulateDepartments && canSimulate(work)) {
      simulateAndComplete(repoRoot, paths, run, pool, roster, work, worker)
    }
  }

  run.workOrders = workOrders
  saveWorkers(paths, roster)
  savePool(paths, pool)

  const counts = poolCounts(pool)
  const hasWork =
    counts.ready > 0
    || counts.in_progress > 0
    || counts.review > 0
    || counts.blocked > 0
    || workOrders.length > 0
    || roster.workers.some((w) => w.status === 'busy')

  appendEvent(paths, {
    type: 'tick',
    runId: run.runId,
    cycle: run.cycle,
    accepted,
    rejected,
    recovered: recovered.length,
    workOrders: workOrders.length,
    dueCadences: due,
  })

  if (!hasWork && config.execution.stopWhenNoHighValueWork !== false) {
    run.mode = 'idle_monitoring'
    run.status = 'running'
    run.phase = 'idle'
    run.stopReason = 'NO_ACTIONABLE_HIGH_VALUE_TASK'
    run.activeTaskId = null
    saveRun(paths, run)
    return {
      ok: true,
      idle: true,
      message: 'NO ACTIONABLE HIGH-VALUE TASK — company idle/monitoring.',
      cycle: run.cycle,
      workOrders: [],
      status: formatStatus(loadStore(repoRoot, options)),
      dashboard: renderCompanyDashboard(loadStore(repoRoot, options)),
      improvement: concludeNoImprovement(),
    }
  }

  run.mode = 'autonomous'
  run.status = 'running'
  run.phase = workOrders.length ? 'implement' : 'operating'
  run.activeTaskId = workOrders[0]?.taskId || run.activeTaskId
  run.stopReason = null
  saveRun(paths, run)

  return {
    ok: true,
    idle: false,
    stopped: false,
    cycle: run.cycle,
    accepted,
    rejected,
    workOrders,
    recovered: recovered.length,
    status: formatStatus(loadStore(repoRoot, options)),
    dashboard: renderCompanyDashboard(loadStore(repoRoot, options)),
    nextAgentSteps: [
      'Execute open work orders from this tick',
      'Record evidence + complete via CLI',
      'npm run company -- tick  # company continues after each completion',
    ],
  }
}

function shouldDeclineWork(worker, work) {
  const onlyHypothesis =
    (work.evidence || []).length > 0
    && (work.evidence || []).every((e) => e.labeled === 'hypothesis')
  return (
    worker.department === 'engineering'
    && onlyHypothesis
    && String(work.origin || '').startsWith('cadence:')
  )
}

function canSimulate(work) {
  return (
    ['research', 'self_improvement', 'tech_debt'].includes(work.category)
    && String(work.origin || '').startsWith('cadence:')
  )
}

function simulateAndComplete(repoRoot, paths, run, pool, roster, work, worker) {
  if (work.category === 'research') {
    work.status = 'completed'
    work.executionEvidence = [
      ...(work.executionEvidence || []),
      { type: 'research', note: 'Monitor — no migration', at: nowIso() },
    ]
    saveTask(paths, work)
    syncPoolSummary(paths, pool, work)
    releaseWorker(roster, worker.id, { outcome: 'completed' })
    run.locks = releaseLocks(run, work.id)
    saveWorkers(paths, roster)
    return
  }
  // Other cadence work: leave as in_progress for agent unless auto full-sim
  void repoRoot
}

export function buildWorkOrder(task, worker) {
  return {
    taskId: task.id,
    workerId: worker?.id || null,
    department: worker?.department || task.department,
    phase: 'implement',
    title: task.title,
    category: task.category,
    engineerSubtype: task.engineerSubtype || routeEngineerSubtype(task),
    agents: agentsForPhase('implement').map((a) => ({
      id: a.id,
      responsibility: a.responsibility,
    })),
    capabilities: worker?.capabilities || [],
    antiSlopRequired: true,
    steps: [
      'Load CONTEXT.md and docs/AI_WORKFLOW.md',
      'Write proposal under .autonomous-company/artifacts/<taskId>/',
      'Execute via worker capabilities (Matt/project skills)',
      'Record real validation evidence',
      'Independent review before complete',
      'npm run company -- complete <taskId> --report ...',
      'npm run company -- tick   # REQUIRED — company continues',
    ],
    reuseSkills: worker?.capabilities || [
      'implement-feature',
      'matt implement/tdd (one TDD only)',
      'review-changes',
      'validate-release',
    ],
  }
}

export function completeWorkItem(repoRoot, taskId, report, options = {}) {
  const store = loadStore(repoRoot, options)
  const { paths, run, pool, config } = store
  const roster = ensureWorkers(store)
  const task = loadTask(paths, taskId)
  if (!task) throw new Error(`Unknown task: ${taskId}`)

  const antiSlop = evaluateAntiSlopAnswers(report.antiSlopAnswers || {})
  if (!antiSlop.pass) return { ok: false, error: 'anti_slop_failed', antiSlop }

  const gates = evaluateGates({ category: task.category, checklist: report.gateChecklist || {} })
  if (!gates.pass) return { ok: false, error: 'gates_failed', gates }

  if (config.execution.requireReviewForCode && report.reviewVerdict !== 'approve') {
    if (['bug', 'security', 'product', 'ux'].includes(task.category)) {
      return { ok: false, error: 'review_required', reviewVerdict: report.reviewVerdict || null }
    }
  }

  for (const v of report.validationResults || []) {
    if (v.status === 'skipped' && v.required) {
      return { ok: false, error: 'required_validation_skipped', command: v.command }
    }
    if (v.claimedPass && v.status !== 'passed') {
      return { ok: false, error: 'falsified_validation', command: v.command }
    }
  }

  task.status = 'completed'
  task.completionReport = {
    at: nowIso(),
    summary: report.summary || null,
    validationResults: report.validationResults || [],
    reviewVerdict: report.reviewVerdict,
  }
  task.executionEvidence = [
    ...(task.executionEvidence || []),
    ...(report.validationResults || []).map((v) => ({
      type: 'validation',
      command: v.command,
      exitCode: v.exitCode,
      status: v.status,
      at: nowIso(),
    })),
  ]
  task.productFeedback = buildProductFeedback(task, report)
  saveTask(paths, task)
  syncPoolSummary(paths, pool, task)

  if (task.ownerWorkerId) releaseWorker(roster, task.ownerWorkerId, { outcome: 'completed' })
  run.locks = releaseLocks(run, task.id)
  if (run.activeTaskId === task.id) run.activeTaskId = null
  run.mode = run.mode === 'stopped' ? 'stopped' : 'autonomous'
  run.status = run.status === 'stopped' ? 'stopped' : 'running'
  run.phase = 'operating'
  saveWorkers(paths, roster)
  saveRun(paths, run)

  const followUps = proposeFollowUps(task, report)
  const enqueued = []
  for (const fu of followUps) {
    const up = upsertCandidate(paths, pool, { ...fu, status: 'discovered' })
    const saved = loadTask(paths, up.id)
    if (saved && up.created !== false) {
      const pri = prioritizeCandidates(
        [
          {
            category: saved.category,
            problemKey: saved.problemKey,
            title: saved.title,
            evidence: saved.evidence,
            impact: saved.impact,
            effort: saved.effort,
            risks: saved.risks,
            hypothesis: saved.hypothesis,
            ownerRole: saved.ownerRole,
            filesLikely: saved.filesLikely,
            acceptanceCriteria: saved.acceptanceCriteria,
            validationPlan: saved.validationPlan,
          },
        ],
        config,
      )[0]
      if (pri?.decision === 'queue') {
        saved.status = 'ready'
        saved.priority = pri.priority
        saveTask(paths, saved)
        syncPoolSummary(paths, pool, saved)
        enqueued.push(saved.id)
      } else {
        saved.status = 'rejected'
        saved.rejection = {
          reasons: pri?.challenge?.reasons || ['low_value_followup'],
          at: nowIso(),
        }
        saveTask(paths, saved)
        syncPoolSummary(paths, pool, saved)
      }
    }
  }

  recordDecision(store.memory, {
    title: `Completed ${task.title}`,
    decision: report.summary || 'completed with evidence',
    evidence: [`task:${task.id}`],
  })
  saveMemory(paths, store.memory)
  appendEvent(paths, {
    type: 'work_completed',
    runId: run.runId,
    taskId: task.id,
    followUps: enqueued,
  })

  return {
    ok: true,
    task,
    followUps: enqueued,
    companyContinues: true,
    next: 'npm run company -- tick',
    status: formatStatus(loadStore(repoRoot, options)),
    dashboard: renderCompanyDashboard(loadStore(repoRoot, options)),
  }
}

export function pauseCompany(repoRoot, reason = 'paused', options = {}) {
  const store = loadStore(repoRoot, options)
  store.run.status = 'interrupted'
  store.run.mode = 'paused'
  store.run.stopReason = reason
  saveRun(store.paths, store.run)
  appendEvent(store.paths, { type: 'company_paused', runId: store.run.runId, reason })
  return formatStatus(loadStore(repoRoot, options))
}

export function stopCompany(repoRoot, reason = 'manual_stop', options = {}) {
  return enterStop(repoRoot, reason, options).status
}

export function requestHighImpactAction(repoRoot, action, options = {}) {
  const store = loadStore(repoRoot, options)
  const result = checkSafetyAction(action, store.config, options)
  appendEvent(store.paths, {
    type: 'high_impact_request',
    runId: store.run.runId,
    action,
    allowed: result.allowed,
    reason: result.reason,
  })
  return result
}
