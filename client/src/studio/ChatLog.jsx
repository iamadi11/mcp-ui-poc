function thoughtText(item) {
  return item?.thought || item?.text || item?.reason || ''
}

export function ChatLog({ messages, thoughts = [], pending = false, listRef }) {
  const live = thoughts.map(thoughtText).filter(Boolean)
  const lastUser = [...(messages || [])].map((m, i) => [m, i]).reverse().find(([m]) => m.role === 'user')
  const lastUserIndex = lastUser ? lastUser[1] : -1
  const persistedThisTurn = (messages || []).slice(lastUserIndex + 1).some((m) => m.role === 'thought')
  const showLive = pending && (live.length > 0 || !persistedThisTurn)

  return (
    <div className="chat-log is-thin" ref={listRef} aria-label="What you asked">
      {(messages || []).filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'thought').map((m, i) => (
        m.role === 'thought' ? (
          <div key={`${m.role}-${i}`} className="bubble bubble-thought" aria-label="Agent thinking">
            <p className="thought-kicker">Thinking</p>
            <p className="thought-body">{m.text}</p>
          </div>
        ) : (
          <div key={`${m.role}-${i}`} className={`bubble bubble-${m.role}`}>
            {m.text}
          </div>
        )
      ))}
      {showLive ? (
        <div className="bubble bubble-thought is-live" aria-live="polite" aria-label="Agent thinking">
          <p className="thought-kicker">Thinking</p>
          {live.length ? (
            <ul className="thought-list">
              {live.slice(-8).map((text, i) => (
                <li key={`${i}-${text.slice(0, 32)}`}>{text}</li>
              ))}
            </ul>
          ) : (
            <p className="thought-pending">
              Working on this turn
              <span className="thought-cursor" aria-hidden="true" />
            </p>
          )}
        </div>
      ) : null}
    </div>
  )
}
