import { useState } from 'react'
import { DEFAULT_GLASS } from './glassAppearance.js'

const SLIDERS = [
  { key: 'blur', label: 'Blur', min: 6, max: 44, unit: 'px' },
  { key: 'frost', label: 'Frost', min: 0, max: 100 },
  { key: 'border', label: 'Edge light', min: 0, max: 100 },
  { key: 'saturate', label: 'Color pop', min: 100, max: 220, unit: '%' },
  { key: 'mesh', label: 'Backdrop mesh', min: 0, max: 100 },
  { key: 'roundness', label: 'Roundness', min: 0, max: 100 },
]

export function GlassControls({ glass, setGlass }) {
  const [open, setOpen] = useState(false)

  const update = (key) => (e) => {
    const v = Number(e.target.value)
    setGlass((g) => ({ ...g, [key]: v }))
  }

  return (
    <aside className="glass-controls">
      <button
        type="button"
        className="glass-controls__fab"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="glass-controls-panel"
        id="glass-controls-trigger"
      >
        Glass
      </button>
      {open && (
        <div
          id="glass-controls-panel"
          className="glass-controls__panel"
          role="region"
          aria-labelledby="glass-controls-trigger"
        >
          <div className="glass-controls__head">
            <span className="glass-controls__title">Glass look</span>
            <button
              type="button"
              className="glass-controls__reset"
              onClick={() => setGlass({ ...DEFAULT_GLASS })}
            >
              Reset
            </button>
          </div>

          {SLIDERS.map(({ key, label, min, max, unit }) => (
            <div className="glass-controls__row" key={key}>
              <div className="glass-controls__row-top">
                <label htmlFor={`glass-${key}`}>{label}</label>
                <span className="glass-controls__val">
                  {glass[key]}
                  {unit || ''}
                </span>
              </div>
              <input
                id={`glass-${key}`}
                type="range"
                min={min}
                max={max}
                value={glass[key]}
                onChange={update(key)}
              />
            </div>
          ))}

          <p className="glass-controls__hint">Saved in this browser only.</p>
        </div>
      )}
    </aside>
  )
}
