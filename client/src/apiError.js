/**
 * Build a user-visible Error from a failed fetch Response.
 * If the body was already consumed, pass it as `preReadBody` (e.g. get-data flow).
 */
export async function errorFromResponse(response, preReadBody) {
  let body = preReadBody
  if (preReadBody === undefined) {
    try {
      body = await response.json()
    } catch {
      body = null
    }
  }
  let msg =
    body && typeof body.error === 'string'
      ? body.error
      : `HTTP ${response.status}`
  if (response.status === 429) {
    const ra = response.headers.get('Retry-After')
    if (ra) {
      const sec = Number(ra)
      msg += Number.isFinite(sec)
        ? ` Retry in about ${sec}s.`
        : ` (${ra})`
    }
  }
  if (
    response.status === 413 &&
    body &&
    body.code === 'HTML_TOO_LARGE' &&
    typeof body.limitBytes === 'number'
  ) {
    msg += ` (limit ${body.limitBytes} bytes)`
  }
  return new Error(msg)
}
