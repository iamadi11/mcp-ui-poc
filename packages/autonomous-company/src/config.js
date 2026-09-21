import { createHash, randomUUID } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const PACKAGE_ROOT = join(__dirname, '..')
export const DEFAULTS_DIR = join(PACKAGE_ROOT, 'defaults')

export const PHASES = Object.freeze([
  'boot',
  'discover',
  'define',
  'design',
  'breakdown',
  'implement',
  'validate',
  'review',
  'integrate',
  'release_ready',
  'postmortem',
  'operating',
  'idle',
])

export const TASK_CATEGORIES = Object.freeze([
  'product',
  'ux',
  'bug',
  'security',
  'performance',
  'tech_debt',
  'test_gap',
  'documentation',
  'dx',
  'reliability',
  'accessibility',
  'infrastructure',
  'research',
  'unfinished',
  'regression',
  'self_improvement',
])

export const TASK_STATUSES = Object.freeze([
  'discovered',
  'proposed',
  'triaged',
  'ready',
  'claimed',
  'in_progress',
  'blocked',
  'review',
  'validation',
  'ready_to_merge',
  'completed',
  'rejected',
  'deferred',
  'abandoned',
  'stale',
  // legacy
  'candidate',
  'queued',
  'active',
  'in_review',
  'failed',
])

export function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return structuredClone(base)
  const out = structuredClone(base)
  for (const [key, value] of Object.entries(override)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      out[key] &&
      typeof out[key] === 'object' &&
      !Array.isArray(out[key])
    ) {
      out[key] = deepMerge(out[key], value)
    } else {
      out[key] = value
    }
  }
  return out
}

export function loadConfig(repoRoot, overrides = {}) {
  const defaults = loadJson(join(DEFAULTS_DIR, 'config.json'))
  const committedPath = join(repoRoot, 'autonomous-company.config.json')
  const localPath = join(
    repoRoot,
    defaults.paths.stateDir,
    'config.json',
  )
  let config = defaults
  if (existsSync(committedPath)) {
    config = deepMerge(config, loadJson(committedPath))
  }
  if (existsSync(localPath)) {
    config = deepMerge(config, loadJson(localPath))
  }
  return deepMerge(config, overrides)
}

export function fingerprintTask({ category, problemKey }) {
  const raw = `${category}::${String(problemKey).trim().toLowerCase()}`
  return createHash('sha256').update(raw).digest('hex').slice(0, 16)
}

export function newId(prefix = 'id') {
  return `${prefix}_${randomUUID().replace(/-/g, '').slice(0, 12)}`
}

export function nowIso() {
  return new Date().toISOString()
}

export function assertPhase(phase) {
  if (!PHASES.includes(phase)) {
    throw new Error(`Unknown phase: ${phase}`)
  }
}
