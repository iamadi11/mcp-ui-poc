import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { decideNext } from '../src/director/decide.js'

function emptyRun(overrides = {}) {
  return {
    version: 1,
    runId: 'test',
    status: 'running',
    phase: 'discovery',
    cycle: 0,
    maxCycles: 24,
    goal: 'test',
    gates: {
      problem_understood: false,
      requirements_defined: false,
      feasibility_proven: false,
      architecture_validated: false,
      implementation_complete: false,
      tests_passing: false,
      security_acceptable: false,
      performance_acceptable: false,
      product_validation_acceptable: false,
      release_ready: false,
    },
    activeWorkOrder: null,
    completed: [],
    stopReason: null,
    ...overrides,
  }
}

test('decideNext asks for product when PRD missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'auto-'))
  writeFileSync(join(dir, 'TECHNOLOGY_DECISIONS.md'), '# tech\n')
  const d = decideNext(emptyRun(), dir)
  assert.equal(d.order.skill, 'auto-product')
  rmSync(dir, { recursive: true, force: true })
})

test('decideNext asks for research when tech decisions missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'auto-'))
  const d = decideNext(emptyRun(), dir)
  assert.equal(d.order.skill, 'auto-research')
  rmSync(dir, { recursive: true, force: true })
})

test('decideNext asks for POC before architecture when report missing', () => {
  const dir = mkdtempSync(join(tmpdir(), 'auto-'))
  writeFileSync(join(dir, 'TECHNOLOGY_DECISIONS.md'), '# tech\n')
  mkdirSync(join(dir, 'docs/product'), { recursive: true })
  writeFileSync(join(dir, 'docs/product/PRD.md'), '# prd\n')
  writeFileSync(join(dir, 'docs/product/acceptance-criteria.md'), '# ac\n')
  const d = decideNext(emptyRun(), dir)
  assert.equal(d.order.skill, 'auto-poc')
  assert.equal(d.phase, 'poc')
  rmSync(dir, { recursive: true, force: true })
})

test('decideNext idles after post-release review completes', () => {
  const dir = mkdtempSync(join(tmpdir(), 'auto-'))
  writeFileSync(join(dir, 'TECHNOLOGY_DECISIONS.md'), '# tech\n')
  writeFileSync(join(dir, 'ARCHITECTURE.md'), '# arch\n')
  writeFileSync(join(dir, 'SECURITY.md'), '# sec\n')
  mkdirSync(join(dir, 'docs/product'), { recursive: true })
  writeFileSync(join(dir, 'docs/product/PRD.md'), '# prd\n')
  writeFileSync(join(dir, 'docs/product/acceptance-criteria.md'), '# ac\n')
  mkdirSync(join(dir, 'docs/poc'), { recursive: true })
  writeFileSync(join(dir, 'docs/poc/x-POC_REPORT.md'), '# poc\n')
  mkdirSync(join(dir, 'docs/architecture'), { recursive: true })
  writeFileSync(join(dir, 'docs/architecture/ADR-001-x.md'), '# adr\n')
  mkdirSync(join(dir, 'Sources/MacAgentSecurity'), { recursive: true })
  mkdirSync(join(dir, 'docs/qa'), { recursive: true })
  writeFileSync(join(dir, 'docs/qa/r.md'), '# qa\n')
  mkdirSync(join(dir, 'docs/security'), { recursive: true })
  writeFileSync(join(dir, 'docs/security/r.md'), '# sec\n')
  mkdirSync(join(dir, 'docs/performance'), { recursive: true })
  writeFileSync(join(dir, 'docs/performance/r.md'), '# perf\n')
  mkdirSync(join(dir, 'docs/release'), { recursive: true })
  writeFileSync(join(dir, 'docs/release/readiness.md'), '# ready\n')

  const d = decideNext(
    emptyRun({
      gates: {
        problem_understood: true,
        requirements_defined: true,
        feasibility_proven: true,
        architecture_validated: true,
        implementation_complete: true,
        tests_passing: true,
        security_acceptable: true,
        performance_acceptable: true,
        product_validation_acceptable: true,
        release_ready: true,
      },
      completed: ['post-release-review'],
    }),
    dir,
  )
  assert.equal(d.idle, true)
  rmSync(dir, { recursive: true, force: true })
})
