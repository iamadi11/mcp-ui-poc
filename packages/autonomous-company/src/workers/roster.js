/**
 * Departmental workers: claimable workforce with leases.
 */

import { nowIso, newId } from '../config.js'
import { AGENTS } from '../agents/registry.js'

export const DEPARTMENTS = Object.freeze([
  'founder',
  'product',
  'customer',
  'engineering',
  'qa',
  'security',
  'architecture',
  'research',
  'debt',
  'devex',
  'improve',
])

export const WORKER_STATUSES = Object.freeze(['idle', 'busy', 'blocked'])

const DEFAULT_CAPABILITIES = {
  founder: ['strategy', 'deliberation'],
  product: ['discovery', 'proposal', 'studio-staff'],
  customer: ['journey', 'manual-qa'],
  engineering: ['implement-feature', 'matt-implement', 'matt-tdd'],
  qa: ['validate-release', 'vitest', 'browser'],
  security: ['security-review', 'safety-gates'],
  architecture: ['research-first', 'adr'],
  research: ['matt-research'],
  debt: ['discovery', 'debt-scan'],
  devex: ['ci', 'tooling'],
  improve: ['retrospective', 'process'],
}

export function createDefaultWorkers({ leaseMs = 30 * 60_000 } = {}) {
  const workers = DEPARTMENTS.map((dept) => {
    const agent = AGENTS[dept === 'architecture' ? 'architect' : dept === 'devex' ? 'improve' : dept] || AGENTS.engineer
    return {
      id: `worker_${dept}`,
      department: dept,
      role: agent?.name || dept,
      status: 'idle',
      capabilities: DEFAULT_CAPABILITIES[dept] || [],
      specialization: null,
      currentWorkId: null,
      leaseExpiresAt: null,
      leaseMs,
      completedCount: 0,
      blockedCount: 0,
      lastError: null,
      updatedAt: nowIso(),
    }
  })
  // Extra engineering capacity for concurrency demos / parallel claims
  workers.push({
    id: 'worker_engineering_2',
    department: 'engineering',
    role: 'Engineer (slot 2)',
    status: 'idle',
    capabilities: DEFAULT_CAPABILITIES.engineering,
    specialization: null,
    currentWorkId: null,
    leaseExpiresAt: null,
    leaseMs,
    completedCount: 0,
    blockedCount: 0,
    lastError: null,
    updatedAt: nowIso(),
  })
  return {
    version: 1,
    updatedAt: nowIso(),
    workers,
  }
}

export function idleWorkers(roster, department = null) {
  return roster.workers.filter(
    (w) => w.status === 'idle' && (!department || w.department === department),
  )
}

export function busyWorkers(roster) {
  return roster.workers.filter((w) => w.status === 'busy')
}

export function findWorker(roster, workerId) {
  return roster.workers.find((w) => w.id === workerId) || null
}

export function preferredDepartmentForWork(work) {
  if (work.department) return work.department
  if (work.ownerRole === 'engineer') return 'engineering'
  if (work.ownerRole && DEPARTMENTS.includes(work.ownerRole)) return work.ownerRole
  return 'engineering'
}

export function claimWorkForWorker(roster, worker, work, { leaseMs } = {}) {
  const ms = leaseMs || worker.leaseMs || 30 * 60_000
  const expires = new Date(Date.now() + ms).toISOString()
  worker.status = 'busy'
  worker.currentWorkId = work.id
  worker.leaseExpiresAt = expires
  worker.updatedAt = nowIso()
  work.status = 'claimed'
  work.ownerWorkerId = worker.id
  work.claim = {
    workerId: worker.id,
    claimedAt: nowIso(),
    leaseExpiresAt: expires,
  }
  work.attempts = (work.attempts || 0) + 1
  return { worker, work }
}

export function releaseWorker(roster, workerId, { outcome = 'idle' } = {}) {
  const worker = findWorker(roster, workerId)
  if (!worker) return null
  if (outcome === 'completed') worker.completedCount = (worker.completedCount || 0) + 1
  if (outcome === 'blocked') worker.blockedCount = (worker.blockedCount || 0) + 1
  worker.status = outcome === 'blocked' ? 'blocked' : 'idle'
  if (outcome !== 'blocked') {
    worker.currentWorkId = null
    worker.leaseExpiresAt = null
  }
  worker.updatedAt = nowIso()
  return worker
}

export function recoverStaleClaims(roster, tasks, { now = Date.now() } = {}) {
  const recovered = []
  for (const worker of roster.workers) {
    if (worker.status !== 'busy' || !worker.leaseExpiresAt) continue
    if (Date.parse(worker.leaseExpiresAt) > now) continue
    const work = tasks.find((t) => t.id === worker.currentWorkId)
    if (work && !['completed', 'rejected', 'abandoned'].includes(work.status)) {
      work.status = 'stale'
      work.claim = null
      work.ownerWorkerId = null
      work.decisionHistory = [
        ...(work.decisionHistory || []),
        { at: nowIso(), type: 'lease_expired', workerId: worker.id },
      ]
      recovered.push({ workId: work.id, workerId: worker.id })
    }
    worker.status = 'idle'
    worker.currentWorkId = null
    worker.leaseExpiresAt = null
    worker.lastError = 'lease_expired'
    worker.updatedAt = nowIso()
  }
  return recovered
}

export function workerCanTake(worker, work) {
  if (worker.status !== 'idle') return false
  const preferred = preferredDepartmentForWork(work)
  // Engineering can take bug/security remediations; security prefers security
  if (worker.department === preferred) return true
  if (worker.department === 'engineering' && ['qa', 'debt', 'devex'].includes(preferred)) {
    return work.category === 'bug' || work.category === 'reliability'
  }
  if (worker.department === 'security' && work.category === 'security') return true
  if (worker.department === 'qa' && ['test_gap', 'regression'].includes(work.category)) return true
  if (worker.department === 'research' && work.category === 'research') return true
  if (worker.department === 'debt' && work.category === 'tech_debt') return true
  if (worker.department === 'improve' && work.category === 'self_improvement') return true
  if (worker.department === 'product' && work.category === 'product') return true
  return false
}

export function newWorkerId(department) {
  return newId(`worker_${department}`)
}
