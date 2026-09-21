import { versionLabel } from './history.js'

export function VersionsBar({ versions = [], activeId, onRestore, disabled }) {
  if (!versions.length) return null
  return (
    <div className="versions-bar">
      <p className="studio-pane-label" id="studio-versions-label">
        Turns
      </p>
      <p className="versions-hint">Restore an earlier send. Not the layout cache.</p>
      <div className="version-list" role="toolbar" aria-labelledby="studio-versions-label">
        {versions.map((version, index) => {
          const on = version.id === activeId
          return (
            <button
              key={version.id || index}
              type="button"
              className={`version-chip ${on ? 'version-chip-on' : ''}`}
              aria-pressed={on}
              disabled={disabled || !version.result}
              title={version.prompt || versionLabel(version, index)}
              onClick={() => onRestore(version)}
            >
              {versionLabel(version, index)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
