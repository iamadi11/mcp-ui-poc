import { agentsForPhase } from '../agents/registry.js'

export function formatStatus(store) {
  const { run, pool, config } = store
  const active = pool.tasks.filter((t) =>
    ['active', 'queued', 'in_review', 'blocked'].includes(t.status),
  )
  const phaseAgents = agentsForPhase(run.phase).map((a) => a.id)
  return {
    runId: run.runId,
    status: run.status,
    phase: run.phase,
    activeTaskId: run.activeTaskId,
    iteration: run.iteration,
    stopReason: run.stopReason,
    lastError: run.lastError,
    locks: run.locks || {},
    budgets: {
      maxIterations: config.execution.maxIterations,
      maxWallTimeMs: config.execution.maxWallTimeMs,
      maxConcurrentTasks: config.execution.maxConcurrentTasks,
      wallDeadlineAt: run.wallDeadlineAt,
    },
    pool: {
      total: pool.tasks.length,
      active: active.length,
      lastDiscoveryAt: pool.lastDiscoveryAt,
      lastNoWorkReason: pool.lastNoWorkReason,
    },
    phaseAgents,
  }
}

export function renderStatusText(status) {
  return [
    `Autonomous Company Status`,
    `-------------------------`,
    `Run:        ${status.runId}`,
    `Status:     ${status.status}`,
    `Phase:      ${status.phase}`,
    `Active:     ${status.activeTaskId || '(none)'}`,
    `Iteration:  ${status.iteration}`,
    `Stop:       ${status.stopReason || '-'}`,
    `Agents:     ${status.phaseAgents.join(', ')}`,
    `Pool:       ${status.pool.active} active / ${status.pool.total} total`,
    `No-work:    ${status.pool.lastNoWorkReason || '-'}`,
  ].join('\n')
}
