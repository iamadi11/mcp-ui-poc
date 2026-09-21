import { describe, it, expect, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  parseEngineeringRoadmapMarkdown,
  discoverEngineeringRoadmap,
  requiresCursorEngineering,
  CURSOR_ENGINEERING_BLOCK_REASON,
  SELECTED_CONFIDENCE,
  DEFERRED_CONFIDENCE,
  discoverCandidates,
  prioritizeCandidates,
  startCompany,
  loadStore,
  bootCompany,
  listTasks,
} from '../src/index.js'

const SAMPLE_ROADMAP = `# Engineering roadmap

## Selected / must implement

| ID | Type | Title | Evidence | Acceptance |
|----|------|-------|----------|------------|
| EE-001 | fix | Fence LLM UNTRUSTED prompts | GitHub #5; planner.js | Add fencing tests |
| EE-010 | feature | Ship embed analytics | CONTEXT.md Embed | Count views |

## Deferred

| ID | Type | Title | Evidence | Why deferred |
|----|------|-------|----------|--------------|
| LA-001 | feature | LocalAdapter ONNX | docs/training-export.md | Future model |
`

function makeRepo(withRoadmap = true) {
  const root = mkdtempSync(join(tmpdir(), 'ac-roadmap-'))
  mkdirSync(join(root, 'server'), { recursive: true })
  mkdirSync(join(root, 'client/src'), { recursive: true })
  mkdirSync(join(root, 'packages/core/src'), { recursive: true })
  mkdirSync(join(root, 'packages/core/test'), { recursive: true })
  mkdirSync(join(root, 'docs'), { recursive: true })
  writeFileSync(join(root, 'CONTEXT.md'), '# Product\n\nChat-first UI studio.\n')
  writeFileSync(join(root, 'docs/AI_WORKFLOW.md'), '# Workflow\n')
  writeFileSync(join(root, 'docs/MANUAL_QA.md'), '# QA\n')
  writeFileSync(join(root, 'packages/core/src/index.js'), 'export const ok = true\n')
  writeFileSync(join(root, 'packages/core/test/index.test.js'), 'import { ok } from "../src/index.js"\n')
  if (withRoadmap) {
    writeFileSync(join(root, 'docs/engineering-roadmap.md'), SAMPLE_ROADMAP)
  }
  return root
}

describe('engineering roadmap discovery', () => {
  let root
  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
  })

  it('parses Selected and Deferred tables with EE-### ids', () => {
    const { selected, deferred } = parseEngineeringRoadmapMarkdown(SAMPLE_ROADMAP)
    expect(selected.map((r) => r.id)).toEqual(['EE-001', 'EE-010'])
    expect(selected[0].type).toBe('fix')
    expect(selected[1].type).toBe('feature')
    expect(deferred.map((r) => r.id)).toEqual(['LA-001'])
  })

  it('emits high-confidence Selected candidates and low-confidence Deferred', () => {
    root = makeRepo(true)
    const candidates = discoverEngineeringRoadmap(root)
    const selected = candidates.filter((c) => c.origin === 'roadmap:selected')
    const deferred = candidates.filter((c) => c.origin === 'roadmap:deferred')
    expect(selected).toHaveLength(2)
    expect(selected.every((c) => c.confidence >= 0.8)).toBe(true)
    expect(selected[0].confidence).toBe(SELECTED_CONFIDENCE)
    expect(selected[0].problemKey).toBe('roadmap:EE-001')
    expect(selected[0].department).toBe('engineering')
    expect(selected[0].evidence[0].path).toBe('docs/engineering-roadmap.md')
    expect(selected[0].evidence[0].labeled).toBe('verified')
    expect(deferred).toHaveLength(1)
    expect(deferred[0].confidence).toBe(DEFERRED_CONFIDENCE)
    expect(deferred[0].evidence[0].labeled).toBe('hypothesis')
  })

  it('discoverCandidates includes Selected when scanEngineeringRoadmap is on', () => {
    root = makeRepo(true)
    bootCompany(root)
    const store = loadStore(root)
    const scanned = discoverCandidates(root, store, {
      discovery: {
        scanTodoMarkers: false,
        scanTestGaps: false,
        scanDocDriftHints: false,
        includeOpenIssues: false,
        scanEngineeringRoadmap: true,
        maxCandidates: 25,
        minEvidenceCount: 1,
      },
    })
    expect(scanned.candidates.some((c) => c.problemKey === 'roadmap:EE-001')).toBe(true)
    expect(scanned.candidates.some((c) => c.problemKey === 'roadmap:EE-010')).toBe(true)
  })

  it('prioritization accepts Selected and rejects weak Deferred', () => {
    root = makeRepo(true)
    const candidates = discoverEngineeringRoadmap(root)
    const prioritized = prioritizeCandidates(candidates, {
      prioritization: {
        rejectBelowScore: 2.5,
        weights: {
          userValue: 1.2,
          productRelevance: 1.0,
          severity: 1.1,
          securityRisk: 1.4,
          reliabilityImpact: 1.1,
          technicalRisk: 0.8,
          effortInverse: 0.7,
          confidence: 1.0,
          reversibility: 0.5,
        },
      },
    })
    const ee = prioritized.find((p) => p.candidate.problemKey === 'roadmap:EE-001')
    const la = prioritized.find((p) => p.candidate.problemKey === 'roadmap:LA-001')
    expect(ee.decision).toBe('queue')
    expect(la.decision).toBe('reject')
  })

  it('requiresCursorEngineering for Selected feature|fix', () => {
    expect(
      requiresCursorEngineering({
        origin: 'roadmap:selected',
        department: 'engineering',
        workType: 'fix',
        category: 'bug',
        confidence: 0.85,
        problemKey: 'roadmap:EE-001',
      }),
    ).toBe(true)
    expect(
      requiresCursorEngineering({
        origin: 'cadence:tech',
        department: 'engineering',
        category: 'tech_debt',
        confidence: 0.4,
      }),
    ).toBe(false)
  })

  it('company start promotes Selected to BLOCKED-for-Cursor (not idle)', () => {
    root = makeRepo(true)
    const started = startCompany(root, { ticks: 2, fresh: true })
    expect(started.ok).toBe(true)
    const store = loadStore(root)
    const tasks = listTasks(store.paths)
    const selected = tasks.filter((t) => t.origin === 'roadmap:selected')
    expect(selected.length).toBeGreaterThanOrEqual(1)
    expect(selected.some((t) => t.status === 'blocked')).toBe(true)
    expect(
      selected.some((t) => t.blockReason === CURSOR_ENGINEERING_BLOCK_REASON),
    ).toBe(true)
    expect(store.run.stopReason).toBe('HIGH_VALUE_WORK_EXISTS')
    expect(store.run.mode).not.toBe('idle_monitoring')
    const orders = started.workOrders || []
    const blockedOrders = (started.results || [])
      .flatMap((r) => r.workOrders || [])
      .concat(orders)
      .filter((o) => o.blockedForCursor)
    expect(blockedOrders.length).toBeGreaterThanOrEqual(1)
  })
})
