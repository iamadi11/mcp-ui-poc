import { describe, it, expect } from 'vitest'
import { shouldUseLlm, catalogExpressible, motionToken, pickPlannerPath } from '../src/decisions/router.js'
import { layoutChoiceConfidence, minChoiceConfidence } from '../src/jev/planner.js'
import { heuristicAdapter } from '../src/decisions/heuristic.js'
import { localAdapter } from '../src/decisions/local.js'
import { ROUTING_QUESTION_IDS, DECISION_IO } from '../src/decisions/schema.js'
import { buildJevQuestions } from '../src/jev/planner.js'

describe('shouldUseLlm', () => {
  it('uses Jev when confidence is high and the catalog can express the ask', () => {
    expect(shouldUseLlm({ needs_llm: { noul: 0.1 }, in_catalog: { noul: 0.9 } }, 0.8, 0.5)).toBe(false)
  })

  it('uses LLM when unknown and the catalog cannot express the ask', () => {
    expect(
      shouldUseLlm(
        { in_catalog: { noul: 0.1 }, named_widget: { choice: 'none', confidence: 0.4 } },
        0.8,
        0.5,
        { surface: { kind: 'unknown', catalog: false } },
      ),
    ).toBe(true)
  })

  it('falls to Haiku on low confidence, needs_llm, or out-of-catalog', () => {
    expect(shouldUseLlm({}, 0.2, 0.5)).toBe(true)
    expect(shouldUseLlm({ needs_llm: { noul: 0.9 }, in_catalog: { noul: 0.1 } }, 0.9, 0.5)).toBe(true)
    expect(shouldUseLlm({ in_catalog: { noul: 0.1 } }, 0.9, 0.5)).toBe(true)
  })

  it('stays on Jev when the catalog already expresses the ask', () => {
    expect(
      shouldUseLlm(
        {
          named_widget: { choice: 'chart', confidence: 0.8 },
          needs_llm: { noul: 0.9 },
          in_catalog: { noul: 0.2 },
        },
        0.28,
        0.5,
      ),
    ).toBe(false)
    expect(
      shouldUseLlm(
        {
          named_widget: { choice: 'none', confidence: 0.4 },
          include_table: { noul: 0.9, confidence: 0.12 },
          needs_llm: { noul: 0.85 },
        },
        0.12,
        0.5,
      ),
    ).toBe(false)
  })
})

describe('catalogExpressible', () => {
  it('treats a named catalog widget or include_* as in-catalog', () => {
    expect(catalogExpressible({ named_widget: { choice: 'table' } })).toBe(true)
    expect(catalogExpressible({ include_chart: { noul: 0.8 } })).toBe(true)
    expect(catalogExpressible({ in_catalog: { noul: 0.9 } })).toBe(true)
    expect(catalogExpressible({ named_widget: { choice: 'none' }, in_catalog: { noul: 0.1 } })).toBe(false)
  })

  it('does not treat a named checkout as in-catalog when the surface is generated', () => {
    expect(
      catalogExpressible(
        { named_widget: { choice: 'checkout' }, include_checkout: { noul: 0.95 } },
        { surface: { kind: 'commerce', catalog: false } },
      ),
    ).toBe(false)
  })
})

describe('layoutChoiceConfidence', () => {
  it('ignores intent, motion, and unused include_* confidence', () => {
    const answers = {
      named_widget: { choice: 'chart', confidence: 0.85 },
      surface: { choice: 'page', confidence: 0.8 },
      chart_type: { choice: 'bar', confidence: 0.82 },
      intent: { choice: 'create_dashboard', confidence: 0.28 },
      motion: { choice: 'stagger', confidence: 0.22 },
      include_badge_row: { noul: 0.05, confidence: 0.11 },
    }
    expect(minChoiceConfidence(answers)).toBe(0.11)
    expect(layoutChoiceConfidence(answers)).toBe(0.8)
  })
})

describe('motionToken', () => {
  it('reads the motion choice or needs_motion noul', () => {
    expect(motionToken({ motion: { choice: 'stagger' } })).toBe('stagger')
    expect(motionToken({ needs_motion: { noul: 0.8 } })).toBe('enter')
    expect(motionToken({})).toBe('none')
  })
})

describe('pickPlannerPath', () => {
  it('prefers replay, then Jev, then LLM, then heuristic', () => {
    expect(pickPlannerPath({ cachedPolicy: { presentation: 'page' } })).toBe('replay')
    expect(pickPlannerPath({ jevOk: true, useLlm: false })).toBe('jev')
    expect(pickPlannerPath({ jevOk: true, useLlm: true, llmAvailable: true })).toBe('llm')
    expect(pickPlannerPath({})).toBe('heuristic')
  })
})

describe('heuristicAdapter', () => {
  it('answers the frozen routing questions from keywords', async () => {
    const { answers, confidence } = await heuristicAdapter.decide({
      state: { instructions: 'show as a table', sourceUrl: 'https://example.com' },
    })
    expect(answers.named_widget.choice).toBe('table')
    expect(answers.intent.choice).toBe('fetch_api')
    expect(confidence).toBeLessThan(0.5)
  })
})

describe('localAdapter', () => {
  it('exposes the frozen I/O and is unavailable', async () => {
    expect(localAdapter.io).toBe(DECISION_IO)
    expect(localAdapter.questionIds).toEqual(ROUTING_QUESTION_IDS)
    expect(localAdapter.isAvailable()).toBe(false)
    await expect(localAdapter.decide()).rejects.toMatchObject({ code: 'LOCAL_ADAPTER_UNAVAILABLE' })
  })
})

describe('buildJevQuestions', () => {
  it('fans out routing questions in one object', () => {
    const q = buildJevQuestions({ fields: [{ key: 'name', type: 'string' }] })
    for (const id of ROUTING_QUESTION_IDS) {
      expect(q[id], id).toBeTruthy()
    }
    expect(q.field_0.type).toBe('noul')
  })
})
