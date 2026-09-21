function parseBlock(block, onEvent) {
  let event = 'message'
  const dataLines = []
  for (const line of String(block || '').split('\n')) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
  }
  if (!dataLines.length) return null
  let data = dataLines.join('\n')
  try {
    data = JSON.parse(data)
  } catch {
    /* keep string */
  }
  onEvent(event, data)
  return event === 'rendered' ? data : null
}

export async function readSse(response, onEvent) {
  if (!response.body) {
    const json = await response.json()
    onEvent('rendered', json)
    return json
  }
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lastRendered = null
  let done = false
  while (!done) {
    const chunk = await reader.read()
    done = chunk.done
    buffer += decoder.decode(chunk.value || new Uint8Array(), { stream: !done })
    const blocks = buffer.split('\n\n')
    if (done) {
      for (const block of blocks) {
        const rendered = parseBlock(block, onEvent)
        if (rendered) lastRendered = rendered
      }
      break
    }
    buffer = blocks.pop() || ''
    for (const block of blocks) {
      const rendered = parseBlock(block, onEvent)
      if (rendered) lastRendered = rendered
    }
  }
  return lastRendered
}
