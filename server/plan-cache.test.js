import { describe, it, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { createPlanCache } from './plan-cache.js'

describe('planCache', () => {
  let cache
  beforeEach(() => {
    cache = createPlanCache({ ttlMs: 60_000, max: 3 })
  })

  it('hits on identical plan keys', () => {
    const key = cache.planKey({
      url: 'https://api.example.com',
      instructions: 'dashboard',
      designSystem: 'shadcn',
      llmProvider: 'anthropic',
    })
    cache.set(key, { ok: true })
    assert.deepEqual(cache.get(key), { ok: true })
  })

  it('misses when instructions differ', () => {
    const a = cache.planKey({ url: 'https://x', instructions: 'a' })
    const b = cache.planKey({ url: 'https://x', instructions: 'b' })
    cache.set(a, { n: 1 })
    assert.equal(cache.get(b), undefined)
  })

  it('bypasses cache when a user api key is present', () => {
    assert.equal(cache.shouldCache({}), true)
    assert.equal(cache.shouldCache({ apiKey: 'sk-user' }), false)
    assert.equal(cache.shouldCache({ typesafeApiKey: 'ts-user' }), false)
  })

  it('expires entries after TTL', async () => {
    const short = createPlanCache({ ttlMs: 20, max: 10 })
    const key = short.planKey({ url: 'https://x', instructions: '' })
    short.set(key, { stale: false })
    assert.deepEqual(short.get(key), { stale: false })
    await new Promise((r) => setTimeout(r, 35))
    assert.equal(short.get(key), undefined)
  })

  it('evicts oldest when over max', () => {
    const a = cache.planKey({ url: 'a', instructions: '' })
    const b = cache.planKey({ url: 'b', instructions: '' })
    const c = cache.planKey({ url: 'c', instructions: '' })
    const d = cache.planKey({ url: 'd', instructions: '' })
    cache.set(a, 1)
    cache.set(b, 2)
    cache.set(c, 3)
    cache.set(d, 4)
    assert.equal(cache.size, 3)
    assert.equal(cache.get(a), undefined)
    assert.equal(cache.get(d), 4)
  })
})
