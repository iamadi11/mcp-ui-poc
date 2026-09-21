import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import {
  readPositiveInt,
  createGenerateLimiter,
  createFeedbackLimiter,
} from './rate-limits.js'

const prevGenerate = process.env.MCP_RATE_LIMIT_GENERATE_PER_MIN
const prevFeedback = process.env.MCP_RATE_LIMIT_FEEDBACK_PER_MIN

describe('readPositiveInt', () => {
  after(() => {
    if (prevGenerate === undefined) delete process.env.MCP_RATE_LIMIT_GENERATE_PER_MIN
    else process.env.MCP_RATE_LIMIT_GENERATE_PER_MIN = prevGenerate
    if (prevFeedback === undefined) delete process.env.MCP_RATE_LIMIT_FEEDBACK_PER_MIN
    else process.env.MCP_RATE_LIMIT_FEEDBACK_PER_MIN = prevFeedback
  })

  it('returns default for missing, empty, or invalid values', () => {
    delete process.env.MCP_RATE_LIMIT_GENERATE_PER_MIN
    assert.equal(readPositiveInt('MCP_RATE_LIMIT_GENERATE_PER_MIN', 45), 45)
    process.env.MCP_RATE_LIMIT_GENERATE_PER_MIN = ''
    assert.equal(readPositiveInt('MCP_RATE_LIMIT_GENERATE_PER_MIN', 45), 45)
    process.env.MCP_RATE_LIMIT_GENERATE_PER_MIN = '0'
    assert.equal(readPositiveInt('MCP_RATE_LIMIT_GENERATE_PER_MIN', 45), 45)
    process.env.MCP_RATE_LIMIT_GENERATE_PER_MIN = '-3'
    assert.equal(readPositiveInt('MCP_RATE_LIMIT_GENERATE_PER_MIN', 45), 45)
    process.env.MCP_RATE_LIMIT_GENERATE_PER_MIN = 'nope'
    assert.equal(readPositiveInt('MCP_RATE_LIMIT_GENERATE_PER_MIN', 45), 45)
  })

  it('parses positive integers from env', () => {
    process.env.MCP_RATE_LIMIT_GENERATE_PER_MIN = '12'
    assert.equal(readPositiveInt('MCP_RATE_LIMIT_GENERATE_PER_MIN', 45), 12)
  })
})

describe('rate limit middleware', () => {
  before(() => {
    process.env.MCP_RATE_LIMIT_GENERATE_PER_MIN = '2'
    process.env.MCP_RATE_LIMIT_FEEDBACK_PER_MIN = '2'
  })
  after(() => {
    if (prevGenerate === undefined) delete process.env.MCP_RATE_LIMIT_GENERATE_PER_MIN
    else process.env.MCP_RATE_LIMIT_GENERATE_PER_MIN = prevGenerate
    if (prevFeedback === undefined) delete process.env.MCP_RATE_LIMIT_FEEDBACK_PER_MIN
    else process.env.MCP_RATE_LIMIT_FEEDBACK_PER_MIN = prevFeedback
  })

  function mockReq(ip = '203.0.113.10') {
    return {
      ip,
      method: 'POST',
      url: '/api/render-endpoint',
      headers: {},
      app: { get: () => false },
    }
  }

  function invoke(limiter, req) {
    return new Promise((resolve) => {
      const res = {
        statusCode: 200,
        headers: {},
        body: null,
        setHeader(k, v) {
          this.headers[k] = v
        },
        getHeader(k) {
          return this.headers[k]
        },
        status(code) {
          this.statusCode = code
          return this
        },
        json(payload) {
          this.body = payload
          resolve({ statusCode: this.statusCode, body: payload, limited: true })
        },
      }
      limiter(req, res, () => resolve({ statusCode: 200, limited: false }))
    })
  }

  it('allows requests under the generate cap then returns RATE_LIMIT 429', async () => {
    const limiter = createGenerateLimiter()
    const req = mockReq('198.51.100.1')
    const a = await invoke(limiter, req)
    const b = await invoke(limiter, req)
    const c = await invoke(limiter, req)
    assert.equal(a.limited, false)
    assert.equal(b.limited, false)
    assert.equal(c.limited, true)
    assert.equal(c.statusCode, 429)
    assert.equal(c.body?.code, 'RATE_LIMIT')
    assert.match(String(c.body?.error || ''), /generate/i)
  })

  it('feedback limiter uses its own 429 message', async () => {
    const limiter = createFeedbackLimiter()
    const req = mockReq('198.51.100.2')
    await invoke(limiter, req)
    await invoke(limiter, req)
    const limited = await invoke(limiter, req)
    assert.equal(limited.statusCode, 429)
    assert.equal(limited.body?.code, 'RATE_LIMIT')
    assert.match(String(limited.body?.error || ''), /feedback/i)
  })
})
