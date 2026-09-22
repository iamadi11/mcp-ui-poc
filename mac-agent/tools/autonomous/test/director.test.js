import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
  existsSync,
  readdirSync,
  unlinkSync,
} from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { decideNext } from '../src/director/decide.js'
import { startAutonomous } from '../src/director/clock.js'
import { SPECIALISTS, executeSpecialist } from '../src/specialists/handlers.js'
import { ensureState } from '../src/state/store.js'

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..', '..')

function clearGeneratedDocs(root) {
  const dirs = [
    'docs/product',
    'docs/poc',
    'docs/architecture',
    'docs/qa',
    'docs/security',
    'docs/performance',
    'docs/release',
    'docs/research',
  ]
  for (const d of dirs) {
    const abs = join(root, d)
    if (!existsSync(abs)) continue
    for (const f of readdirSync(abs)) {
      unlinkSync(join(abs, f))
    }
  }
  const validation = join(root, '.agent/state/validation.md')
  if (existsSync(validation)) unlinkSync(validation)
}

test('startAutonomous progresses multiple phases without stopping after one', () => {
  clearGeneratedDocs(repoRoot)
  const result = startAutonomous(repoRoot, {
    goal: 'Build the local-first Mac AI control application.',
    ticks: 14,
    fresh: true,
  })
  const skills = result.results.map((r) => r.workOrder?.skill).filter(Boolean)
  const phases = result.results.map((r) => r.phase).filter(Boolean)
  assert.ok(skills.length >= 5, `expected multi-stage skills, got ${skills.join(',')}`)
  assert.ok(new Set(skills).size >= 5, `expected ≥5 distinct specialists, got ${[...new Set(skills)].join(',')}`)
  assert.ok(phases.length >= 5, `expected multi-phase, got ${phases.join(',')}`)
  assert.ok(['idle', 'running', 'blocked', 'stopped'].includes(result.status.status))
  assert.ok(existsSync(join(repoRoot, 'docs/product/PRD.md')))
  assert.ok(existsSync(join(repoRoot, 'docs/poc/fast-path-POC_REPORT.md')))
})

test('synthetic empty repo walks research → product → poc via handlers', () => {
  const dir = mkdtempSync(join(tmpdir(), 'auto-synth-'))
  mkdirSync(join(dir, 'docs'), { recursive: true })
  writeFileSync(join(dir, 'README.md'), '# synth\n')
  ensureState(dir, { goal: 'synth' })

  const skills = []
  let run = {
    version: 1,
    runId: 'synth',
    status: 'running',
    phase: 'discovery',
    cycle: 0,
    maxCycles: 24,
    goal: 'synth',
    gates: Object.fromEntries(
      [
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
      ].map((g) => [g, false]),
    ),
    activeWorkOrder: null,
    completed: [],
    stopReason: null,
  }

  for (let i = 0; i < 3; i++) {
    const d = decideNext(run, dir)
    assert.ok(d.order, `expected work order at cycle ${i}`)
    skills.push(d.order.skill)
    assert.ok(SPECIALISTS[d.order.skill], `handler for ${d.order.skill}`)
    const result = executeSpecialist(dir, d.order)
    assert.equal(result.ok, true, result.error || result.summary)
    run.gates = { ...run.gates, ...d.gates, ...result.gateUpdates }
    run.completed.push(d.order.id)
    run.phase = d.phase
  }

  assert.deepEqual(skills, ['auto-research', 'auto-product', 'auto-poc'])
  assert.ok(existsSync(join(dir, 'docs/research/stack-comparison.md')))
  assert.ok(existsSync(join(dir, 'docs/product/PRD.md')))
  assert.ok(existsSync(join(dir, 'docs/poc/fast-path-POC_REPORT.md')))
  assert.match(readFileSync(join(dir, 'docs/poc/fast-path-POC_REPORT.md'), 'utf8'), /Hypothesis/)
  rmSync(dir, { recursive: true, force: true })
})
