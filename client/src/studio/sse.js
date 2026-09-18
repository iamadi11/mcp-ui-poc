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
    if (done) break
    buffer += decoder.decode(chunk.value, { stream: true })
    const blocks = buffer.split('\n\n')
    buffer = blocks.pop() || ''
    for (const block of blocks) {
      let event = 'message'
      const dataLines = []
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) event = line.slice(6).trim()
        else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim())
      }
      if (!dataLines.length) continue
      let data = dataLines.join('\n')
      try {
        data = JSON.parse(data)
      } catch {
        /* keep string */
      }
      if (event === 'rendered') lastRendered = data
      onEvent(event, data)
    }
  }
  return lastRendered
}
