export function DebugTrace({ steps, thoughts, path, reason, totalMs, planner, pending }) {
  if (!steps?.length && !thoughts?.length && !pending) return null
  return (
    <div className={`path-trace${pending ? ' is-live' : ''}`} aria-label="Planner path">
      {path?.length ? (
        <div className="path-pills">
          {path.map((item, i) => (
            <span key={`${item}-${i}`} className="path-pill">{item}</span>
          ))}
        </div>
      ) : null}
      {reason ? <p className="path-reason">{reason}</p> : null}
      {planner || totalMs != null ? (
        <p className="muted">{[planner, totalMs != null ? `${totalMs}ms` : null].filter(Boolean).join(' · ')}</p>
      ) : null}
    </div>
  )
}
