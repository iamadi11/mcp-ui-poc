import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  layaAvailable,
  layaAdapter,
  decideBackend,
  decisionProviderPreference,
  resolveAskDecision,
} from '../src/decisions/index.js'
import { openaiAdapter } from '../src/llm/openai.js'

describe('Laya DecisionAdapter', () => {
  const prev = { ...process.env }

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in prev)) delete process.env[key]
    }
    Object.assign(process.env, prev)
  })

  it('is available when LAYA_BASE_URL is set', () => {
    process.env.LAYA_BASE_URL = 'http://127.0.0.1:8091'
    expect(layaAvailable()).toBe(true)
    expect(decideBackend({})).toBe('laya')
  })

  it('prefers Laya over Jev in auto mode when Laya is configured', () => {
    process.env.DECISION_PROVIDER = 'auto'
    process.env.LAYA_BASE_URL = 'http://127.0.0.1:8091'
    process.env.TYPESAFE_API_KEY = 'ts-test'
    expect(decideBackend({ typesafeApiKey: 'ts-test' })).toBe('laya')
  })

  it('forces Jev when DECISION_PROVIDER=jev', () => {
    process.env.DECISION_PROVIDER = 'jev'
    process.env.LAYA_BASE_URL = 'http://127.0.0.1:8091'
    process.env.TYPESAFE_API_KEY = 'ts-test'
    expect(decideBackend({ typesafeApiKey: 'ts-test' })).toBe('jev')
  })

  it('decide() uses injected askLaya and aggregates confidence', async () => {
    const result = await layaAdapter.decide({
      state: { prompt: 'login page' },
      questions: { named_widget: { type: 'choice', criteria: { 'login-form': 'auth' } } },
      askLaya: async () => ({
        answers: {
          named_widget: { choice: 'login-form', confidence: 0.91 },
          in_catalog: { noul: 0.95, confidence: 0.88 },
        },
        model: 'laya-test',
      }),
    })
    expect(result.answers.named_widget.choice).toBe('login-form')
    expect(result.confidence).toBe(0.88)
    expect(result.model).toBe('laya-test')
  })

  it('resolveAskDecision injects Laya ask when configured', async () => {
    process.env.LAYA_BASE_URL = 'http://127.0.0.1:8091'
    const calls = []
    const resolved = resolveAskDecision({
      askJev: async (args) => {
        calls.push(args)
        return {
          answers: { named_widget: { choice: 'table', confidence: 0.8 } },
          confidence: 0.8,
          model: 'injected',
        }
      },
    })
    expect(resolved.backend).toBe('injected')
    const out = await resolved.ask({ state: {}, questions: {} })
    expect(out.model).toBe('injected')
    expect(calls).toHaveLength(1)
  })

  it('reads DECISION_PROVIDER preference', () => {
    process.env.DECISION_PROVIDER = 'laya'
    expect(decisionProviderPreference()).toBe('laya')
  })
})

describe('OpenAI-compatible base URL', () => {
  const prev = { ...process.env }

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY
    delete process.env.OPENAI_BASE_URL
  })

  afterEach(() => {
    for (const key of Object.keys(process.env)) {
      if (!(key in prev)) delete process.env[key]
    }
    Object.assign(process.env, prev)
  })

  it('is available from OPENAI_BASE_URL alone (Ollama / local)', () => {
    process.env.OPENAI_BASE_URL = 'http://127.0.0.1:11434/v1'
    expect(openaiAdapter.isAvailable()).toBe(true)
  })

  it('is unavailable without key or base URL', () => {
    expect(openaiAdapter.isAvailable()).toBe(false)
  })
})
