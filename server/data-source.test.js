import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { assertSafeEndpoint } from './data-source.js'

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
