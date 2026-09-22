import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  ensureState,
  loadRun,
  saveRun,
  appendEvent,
  agentPaths,
  writeStateMarkdown,
  loadBacklog,
  saveBacklog,
} from '../state/store.js'
import { decideNext } from './decide.js'
import { executeSpecialist } from '../specialists/handlers.js'

export function startAutonomous(repoRoot, { goal, ticks = 8, fresh = false } = {}) {
  if (process.env.AUTONOMOUS_RUNNING === '1' && process.env.AUTONOMOUS_ALLOW_NESTED !== '1') {
    return {
      ok: false,
      message: 'Nested autonomous start blocked (set AUTONOMOUS_ALLOW_NESTED=1 to override)',
      results: [],
      status: formatStatus(repoRoot),
      workOrders: [],
    }
  }
  const prev = process.env.AUTONOMOUS_RUNNING
  process.env.AUTONOMOUS_RUNNING = '1'
  try {
    ensureState(repoRoot, { goal })
    let run = loadRun(repoRoot)
    if (fresh) {
      const gateKeys = Object.keys(run.gates || {})
      run = {
        ...run,
        runId: `run_${Date.now().toString(16)}`,
        status: 'running',
        phase: 'discovery',
        cycle: 0,
        completed: [],
        stopReason: null,
        activeWorkOrder: null,
        gates: Object.fromEntries(gateKeys.map((k) => [k, false])),
        goal: goal || run.goal,
      }
    }
    run.status = 'running'
    run.stopReason = null
    if (goal) run.goal = goal
    saveRun(repoRoot, run)
    appendEvent(repoRoot, { type: 'start', runId: run.runId, goal: run.goal })

    const results = []
    const n = Number(ticks) > 0 ? Number(ticks) : 8
    for (let i = 0; i < n; i++) {
      const tickResult = tickAutonomous(repoRoot)
      results.push(tickResult)
      if (tickResult.idle || tickResult.stopped) break
    }
    return {
      ok: true,
      message: 'Autonomous director ran',
      results,
      status: formatStatus(repoRoot),
      workOrders: results.map((r) => r.workOrder).filter(Boolean),
    }
  } finally {
    if (prev === undefined) delete process.env.AUTONOMOUS_RUNNING
    else process.env.AUTONOMOUS_RUNNING = prev
  }
}

export function tickAutonomous(repoRoot) {
  ensureState(repoRoot)
  const run = loadRun(repoRoot)
  if (run.status === 'stopped') {
    return { idle: false, stopped: true, stopReason: run.stopReason || 'stopped', status: formatStatus(repoRoot) }
  }
  if (run.cycle >= (run.maxCycles || 24)) {
    run.status = 'stopped'
    run.stopReason = 'max_cycles'
    saveRun(repoRoot, run)
    return { idle: false, stopped: true, stopReason: 'max_cycles', status: formatStatus(repoRoot) }
  }

  run.cycle += 1
  run.status = 'running'

  const decision = decideNext(run, repoRoot)
  run.gates = { ...run.gates, ...decision.gates }
  run.phase = decision.phase

  if (decision.idle || !decision.order) {
    run.status = 'idle'
    run.stopReason = decision.stopReason || 'NO_ACTIONABLE_HIGH_VALUE_TASK'
    run.activeWorkOrder = null
    saveRun(repoRoot, run)
    appendEvent(repoRoot, { type: 'idle', reason: run.stopReason, cycle: run.cycle })
    writeStateMarkdown(
      repoRoot,
      'project-state.md',
      `# Project state\n\nStatus: idle\nReason: ${run.stopReason}\nCycle: ${run.cycle}\nPhase: ${run.phase}\n`,
    )
    return { idle: true, stopReason: run.stopReason, phase: run.phase, status: formatStatus(repoRoot) }
  }

  const order = decision.order
  run.activeWorkOrder = order
  saveRun(repoRoot, run)
  appendEvent(repoRoot, { type: 'delegate', skill: order.skill, title: order.title, id: order.id })

  // Auto-execute specialist handlers (Cursor agent may also execute manually).
  const result = executeSpecialist(repoRoot, order)

  const artDir = join(agentPaths(repoRoot).artifacts, order.id)
  mkdirSync(artDir, { recursive: true })
  writeFileSync(
    join(artDir, 'completion.json'),
    JSON.stringify(
      {
        workOrderId: order.id,
        skill: order.skill,
        ok: result.ok,
        summary: result.summary,
        evidence: result.evidence,
        gateUpdates: result.gateUpdates,
        exitCode: result.exitCode ?? null,
        error: result.error || null,
      },
      null,
      2,
    ),
  )

  if (result.ok) {
    run.gates = { ...run.gates, ...result.gateUpdates }
    run.completed = [...(run.completed || []), order.id]
    if (order.meta?.markCompleteKey) {
      run.completed.push(order.meta.markCompleteKey)
    }
    // backlog bookkeeping
    const backlog = loadBacklog(repoRoot)
    backlog.push({
      id: order.id,
      title: order.title,
      why: order.why,
      priority: order.classification === 'RISKY' ? 'P0' : 'P1',
      risk: order.classification,
      status: 'done',
      owner: order.skill,
      evidence: result.evidence,
    })
    saveBacklog(repoRoot, backlog)
    run.activeWorkOrder = null
    appendEvent(repoRoot, { type: 'complete', id: order.id, skill: order.skill, summary: result.summary })
  } else {
    run.status = 'blocked'
    run.stopReason = result.error || 'specialist_failed'
    appendEvent(repoRoot, { type: 'blocked', id: order.id, error: result.error })
  }

  saveRun(repoRoot, run)
  writeStateMarkdown(
    repoRoot,
    'project-state.md',
    `# Project state\n\nStatus: ${run.status}\nPhase: ${run.phase}\nCycle: ${run.cycle}\nLast: ${order.skill} — ${result.summary || result.error}\n`,
  )

  return {
    idle: false,
    stopped: run.status === 'stopped' || run.status === 'blocked',
    stopReason: run.stopReason,
    phase: run.phase,
    workOrder: order,
    result,
    status: formatStatus(repoRoot),
  }
}

export function stopAutonomous(repoRoot, reason = 'user_stop') {
  const run = loadRun(repoRoot)
  run.status = 'stopped'
  run.stopReason = reason
  saveRun(repoRoot, run)
  appendEvent(repoRoot, { type: 'stop', reason })
  return formatStatus(repoRoot)
}

export function formatStatus(repoRoot) {
  ensureState(repoRoot)
  const run = loadRun(repoRoot)
  const openGates = Object.entries(run.gates || {})
    .filter(([, v]) => !v)
    .map(([k]) => k)
  return {
    runId: run.runId,
    status: run.status,
    phase: run.phase,
    cycle: run.cycle,
    maxCycles: run.maxCycles,
    goal: run.goal,
    stopReason: run.stopReason,
    activeWorkOrder: run.activeWorkOrder,
    completedCount: (run.completed || []).length,
    openGates,
    gates: run.gates,
  }
}

export function renderDashboard(status) {
  return [
    'AUTONOMOUS DIRECTOR',
    '─────────────────────────',
    `Run:     ${status.runId}`,
    `Status:  ${status.status}`,
    `Phase:   ${status.phase}`,
    `Cycle:   ${status.cycle}/${status.maxCycles}`,
    `Goal:    ${status.goal || '(none)'}`,
    `Stop:    ${status.stopReason || '-'}`,
    `Done:    ${status.completedCount}`,
    `Open gates: ${status.openGates?.join(', ') || '(none)'}`,
  ].join('\n')
}
