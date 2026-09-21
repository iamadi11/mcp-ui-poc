import { agentsForPhase } from '../agents/registry.js'
import { normalizeStatus, isActiveWork } from '../work/schema.js'

export function formatStatus(store) {
  const { run, pool, config, workers } = store
  const active = pool.tasks.filter((t) =>
    isActiveWork(t.status) || ['ready', 'queued', 'blocked'].includes(normalizeStatus(t.status)),
  )
  const phaseAgents = agentsForPhase(run.phase === 'operating' ? 'discover' : run.phase).map(
    (a) => a.id,
  )
  const roster = workers?.workers || []
  return {
    runId: run.runId,
    status: run.status,
    mode: run.mode || 'stopped',
    phase: run.phase,
    activeTaskId: run.activeTaskId,
    iteration: run.iteration,
    cycle: run.cycle || run.iteration || 0,
    stopReason: run.stopReason,
    lastError: run.lastError,
    locks: run.locks || {},
    workOrders: (run.workOrders || []).length,
    budgets: {
      maxIterations: config.execution.maxIterations,
      maxCycles: config.execution.maxCycles || config.execution.maxIterations,
      maxWallTimeMs: config.execution.maxWallTimeMs,
      maxConcurrentTasks: config.execution.maxConcurrentTasks,
      wallDeadlineAt: run.wallDeadlineAt,
    },
    workers: {
      total: roster.length,
      idle: roster.filter((w) => w.status === 'idle').length,
      busy: roster.filter((w) => w.status === 'busy').length,
      blocked: roster.filter((w) => w.status === 'blocked').length,
    },
    pool: {
      total: pool.tasks.length,
      active: active.length,
      byStatus: countByStatus(pool.tasks),
      lastDiscoveryAt: pool.lastDiscoveryAt,
      lastNoWorkReason: pool.lastNoWorkReason,
    },
    phaseAgents,
  }
}

function countByStatus(tasks) {
  const out = {}
  for (const t of tasks) {
    const s = normalizeStatus(t.status)
    out[s] = (out[s] || 0) + 1
  }
  return out
}

export function renderStatusText(status) {
  return [
    `Autonomous Company Status`,
    `-------------------------`,
    `Run:        ${status.runId}`,
    `Mode:       ${status.mode || '-'}`,
    `Status:     ${status.status}`,
    `Phase:      ${status.phase}`,
    `Cycle:      ${status.cycle ?? status.iteration}`,
    `Active:     ${status.activeTaskId || '(none)'}`,
    `WorkOrders: ${status.workOrders ?? 0}`,
    `Stop:       ${status.stopReason || '-'}`,
    `Workers:    ${status.workers?.busy ?? 0} busy / ${status.workers?.idle ?? 0} idle / ${status.workers?.total ?? 0} total`,
    `Pool:       ${status.pool.active} openish / ${status.pool.total} total`,
    `No-work:    ${status.pool.lastNoWorkReason || '-'}`,
  ].join('\n')
}

export function renderCompanyDashboard(store) {
  const status = formatStatus(store)
  const by = status.pool.byStatus || {}
  const goals = (store.memory?.strategicGoals || store.memory?.goals || []).slice(0, 3)
  const decisions = (store.memory?.importantDecisions || []).slice(-3)
  const lines = [
    'COMPANY STATUS',
    '─────────────────────────',
    `Mode: ${String(status.mode || 'stopped').toUpperCase()}`,
    `Cycle: #${status.cycle ?? 0}`,
    `Run: ${status.runId}`,
    'Workers:',
    `  Active: ${status.workers?.busy ?? 0}`,
    `  Idle: ${status.workers?.idle ?? 0}`,
    `  Blocked: ${status.workers?.blocked ?? 0}`,
    'Work Pool:',
    `  Ready: ${by.ready || 0}`,
    `  In Progress: ${by.in_progress || 0}`,
    `  Review: ${(by.review || 0) + (by.validation || 0)}`,
    `  Blocked: ${by.blocked || 0}`,
    `  Completed: ${by.completed || 0}`,
    `  Rejected: ${by.rejected || 0}`,
    `Current Focus: ${status.activeTaskId || '(none)'}`,
    'Strategic Goals:',
    ...(goals.length ? goals.map((g, i) => `  ${i + 1}. ${typeof g === 'string' ? g : g.title || g}`) : ['  (from CONTEXT / memory)']),
    'Recent Decisions:',
    ...(decisions.length
      ? decisions.map((d) => `  - ${d.title || d.decision}`)
      : ['  (none yet)']),
    `Stop/Idle: ${status.stopReason || '-'}`,
    `Open work orders: ${status.workOrders ?? 0}`,
  ]
  return lines.join('\n')
}
