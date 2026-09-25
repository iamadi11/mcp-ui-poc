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
  // M2 evidence so Darwin hosts still idle when Mac milestone is done.
  writeFileSync(join(dir, 'docs/poc/mac-voice-POC_REPORT.md'), '# mac voice poc\n')
  mkdirSync(join(dir, 'App'), { recursive: true })
  writeFileSync(join(dir, 'App/MacAgentApp.swift'), '// stub\n')
  mkdirSync(join(dir, 'Sources/MacAgentMenuBar'), { recursive: true })
  writeFileSync(
    join(dir, 'Sources/MacAgentMenuBar/MacAgent.entitlements'),
    '<?xml version="1.0"?><plist><dict><key>com.apple.security.device.audio-input</key><true/></dict></plist>\n',
  )
  mkdirSync(join(dir, 'scripts'), { recursive: true })
  writeFileSync(join(dir, 'scripts/package-macos-app.sh'), '#!/bin/bash\n# --install\n')
  mkdirSync(join(dir, 'docs/performance'), { recursive: true })
  writeFileSync(join(dir, 'docs/performance/ollama-bench.md'), '# ollama\n')
  writeFileSync(join(dir, 'docs/performance/r.md'), '# perf\n')
  mkdirSync(join(dir, 'docs/release'), { recursive: true })
  writeFileSync(join(dir, 'docs/release/personal-install.md'), '# personal\n')
  writeFileSync(join(dir, 'docs/release/readiness.md'), '# ready\n')
  writeFileSync(join(dir, 'docs/poc/mac-voice-e2e.md'), '# voice e2e\n')
  mkdirSync(join(dir, 'docs/ui'), { recursive: true })
  writeFileSync(join(dir, 'docs/ui/MENU_BAR.md'), '# menu bar\n')
  mkdirSync(join(dir, 'docs/poc'), { recursive: true })
  writeFileSync(join(dir, 'docs/poc/mac-ax-journey.md'), '# ax\n')
  writeFileSync(join(dir, 'docs/product/m7-confirm-to-act.md'), '# act once\n')
  mkdirSync(join(dir, 'docs/architecture'), { recursive: true })
  writeFileSync(join(dir, 'docs/architecture/ADR-001-x.md'), '# adr\n')
  mkdirSync(join(dir, 'Sources/MacAgentSecurity'), { recursive: true })
  mkdirSync(join(dir, 'docs/qa'), { recursive: true })
  writeFileSync(join(dir, 'docs/qa/r.md'), '# qa\n')
  mkdirSync(join(dir, 'docs/security'), { recursive: true })
  writeFileSync(join(dir, 'docs/security/r.md'), '# sec\n')

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
      completed: [
        'post-release-review',
        'mac-m2-release',
        'mac-m2-review',
        'mac-m3-release',
        'mac-m3-review',
        'mac-m4-validation',
        'mac-m4-review',
        'mac-m5-review',
        'mac-m6-review',
        'mac-m7-product',
        'mac-m7-engineer',
        'mac-m7-review',
      ],
    }),
    dir,
  )
  assert.equal(d.idle, true)
  rmSync(dir, { recursive: true, force: true })
})

test('decideNext schedules Mac app shell on Darwin when App is placeholder', () => {
  if (process.platform !== 'darwin') return
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
  mkdirSync(join(dir, 'App'), { recursive: true })
  writeFileSync(join(dir, 'App/README.md'), '# placeholder only\n')

  const d = decideNext(
    emptyRun({
      gates: Object.fromEntries(
        Object.keys(emptyRun().gates).map((k) => [k, true]),
      ),
      completed: ['post-release-review'],
    }),
    dir,
  )
  assert.equal(d.order.skill, 'auto-engineer')
  assert.equal(d.order.mode, 'mac-app-shell')
  rmSync(dir, { recursive: true, force: true })
})
