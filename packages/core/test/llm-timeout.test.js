import { describe, it, expect, afterEach } from 'vitest'
import { llmTimeoutMs, mapLlmTimeoutError } from '../src/llm/shared.js'

describe('llm timeout helpers', () => {
  const prev = process.env.MCP_LLM_TIMEOUT_MS
  afterEach(() => {
    if (prev === undefined) delete process.env.MCP_LLM_TIMEOUT_MS
    else process.env.MCP_LLM_TIMEOUT_MS = prev
  })

  it('defaults to 30000ms and accepts MCP_LLM_TIMEOUT_MS', () => {
    delete process.env.MCP_LLM_TIMEOUT_MS
    expect(llmTimeoutMs()).toBe(30000)
    process.env.MCP_LLM_TIMEOUT_MS = '45000'
    expect(llmTimeoutMs()).toBe(45000)
    process.env.MCP_LLM_TIMEOUT_MS = '0'
    expect(llmTimeoutMs()).toBe(30000)
  })

  it('maps AbortError/TimeoutError to 504 planner timeout', () => {
    const abort = new Error('The operation was aborted')
    abort.name = 'AbortError'
    const mapped = mapLlmTimeoutError(abort)
    expect(mapped).not.toBe(abort)
    expect(mapped.status).toBe(504)
    expect(mapped.message).toMatch(/Planner timed out after \d+ms/)
  })

  it('passes through unrelated errors', () => {
    const boom = new Error('rate limited')
    expect(mapLlmTimeoutError(boom)).toBe(boom)
  })
})
