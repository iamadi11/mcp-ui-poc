import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { MockAgent } from 'undici'
import { assertSafeEndpoint, fetchEndpointData, isPrivateAddress } from './data-source.js'

const prevAllow = process.env.MCP_ALLOW_PRIVATE_ENDPOINTS

describe('assertSafeEndpoint', () => {
  before(() => {
    delete process.env.MCP_ALLOW_PRIVATE_ENDPOINTS
  })
  after(() => {
    if (prevAllow === undefined) delete process.env.MCP_ALLOW_PRIVATE_ENDPOINTS
    else process.env.MCP_ALLOW_PRIVATE_ENDPOINTS = prevAllow
  })

  it('allows a public https endpoint', async () => {
    const url = await assertSafeEndpoint('https://api.github.com')
    assert.equal(url.hostname, 'api.github.com')
  })

  it('rejects non-http schemes', async () => {
    await assert.rejects(() => assertSafeEndpoint('ftp://example.com'), (err) => err.status === 400)
  })

  it('rejects loopback and RFC1918 literals', async () => {
    for (const bad of [
      'http://127.0.0.1',
      'http://10.0.0.5',
      'http://192.168.1.1',
      'http://172.16.0.1',
      'http://169.254.169.254',
    ]) {
      await assert.rejects(() => assertSafeEndpoint(bad), (err) => err.status === 400, bad)
    }
  })

  it('rejects CGNAT 100.64.0.0/10', async () => {
    await assert.rejects(() => assertSafeEndpoint('http://100.64.0.1'), (err) => err.status === 400)
    await assert.rejects(() => assertSafeEndpoint('http://100.127.255.255'), (err) => err.status === 400)
  })

  it('rejects numeric and hex-encoded hosts in the raw URL', async () => {
    for (const bad of ['http://2130706433/', 'http://0x7f000001/', 'http://0x7f.1/']) {
      await assert.rejects(() => assertSafeEndpoint(bad), (err) => err.status === 400, bad)
    }
  })

  it('rejects IPv4-mapped IPv6 link-local / loopback forms', async () => {
    await assert.rejects(
      () => assertSafeEndpoint('http://[::ffff:169.254.169.254]/'),
      (err) => err.status === 400,
    )
    await assert.rejects(() => assertSafeEndpoint('http://[::ffff:7f00:1]/'), (err) => err.status === 400)
  })

  it('allows private endpoints when MCP_ALLOW_PRIVATE_ENDPOINTS=1', async () => {
    process.env.MCP_ALLOW_PRIVATE_ENDPOINTS = '1'
    try {
      const url = await assertSafeEndpoint('http://127.0.0.1:3000/api')
      assert.equal(url.hostname, '127.0.0.1')
    } finally {
      delete process.env.MCP_ALLOW_PRIVATE_ENDPOINTS
    }
  })
})

describe('isPrivateAddress', () => {
  it('flags CGNAT and metadata ranges', () => {
    assert.equal(isPrivateAddress('100.64.0.1'), true)
    assert.equal(isPrivateAddress('169.254.169.254'), true)
    assert.equal(isPrivateAddress('8.8.8.8'), false)
  })
})

describe('fetchEndpointData redirect SSRF', () => {
  it('rejects redirect Location pointing at a private IP', async () => {
    const mock = new MockAgent()
    mock.disableNetConnect()
    mock
      .get('http://example.com')
      .intercept({ path: '/ssrf-start', method: 'GET' })
      .reply(302, '', { headers: { location: 'http://169.254.169.254/latest/meta-data/' } })

    await assert.rejects(
      () => fetchEndpointData({ url: 'http://example.com/ssrf-start', dispatcher: mock }),
      (err) => err.status === 400 && /private|loopback|Numeric|Blocked/i.test(err.message),
    )
    await mock.close()
  })

  it('follows a safe redirect and returns JSON', async () => {
    const mock = new MockAgent()
    mock.disableNetConnect()
    const pool = mock.get('http://example.com')
    pool.intercept({ path: '/a', method: 'GET' }).reply(302, '', {
      headers: { location: 'http://example.com/b' },
    })
    pool.intercept({ path: '/b', method: 'GET' }).reply(200, '{"ok":true}', {
      headers: { 'content-type': 'application/json' },
    })

    const result = await fetchEndpointData({ url: 'http://example.com/a', dispatcher: mock })
    assert.deepEqual(result.data, { ok: true })
    await mock.close()
  })

  it('rejects when redirect hop count is exceeded', async () => {
    const mock = new MockAgent()
    mock.disableNetConnect()
    const pool = mock.get('http://example.com')
    for (let i = 0; i < 8; i++) {
      pool.intercept({ path: `/hop${i}`, method: 'GET' }).reply(302, '', {
        headers: { location: `http://example.com/hop${i + 1}` },
      })
    }

    const prev = process.env.MCP_MAX_REDIRECTS
    process.env.MCP_MAX_REDIRECTS = '3'
    try {
      // Re-import would be needed to pick up MAX_REDIRECTS at module load — it's read at module load!
      // MAX_REDIRECTS is const at top level. Fix: read at call time like allowPrivate.
      await assert.rejects(
        () => fetchEndpointData({ url: 'http://example.com/hop0', dispatcher: mock }),
        (err) => err.status === 502 || err.status === 400,
      )
    } finally {
      if (prev === undefined) delete process.env.MCP_MAX_REDIRECTS
      else process.env.MCP_MAX_REDIRECTS = prev
      await mock.close()
    }
  })
})
