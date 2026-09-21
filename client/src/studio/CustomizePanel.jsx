import { Button } from '@/components/ui/button'

const THEMES = [
  { id: 'shadcn', label: 'Studio' },
  { id: 'material', label: 'Material' },
  { id: 'plain', label: 'Editorial' },
  { id: 'glass', label: 'Glass' },
]

const MOTIONS = [
  { id: 'none', label: 'None' },
  { id: 'enter', label: 'Enter' },
  { id: 'stagger', label: 'Stagger' },
  { id: 'live', label: 'Live' },
]

export function CustomizePanel({
  themeId,
  motion,
  look,
  sourceUrl,
  onTheme,
  onMotion,
  onLook,
  onSourceUrl,
  onApply,
  busy,
  published,
}) {
  return (
    <form
      className="customize-panel"
      onSubmit={(e) => {
        e.preventDefault()
        onApply()
      }}
    >
      <p className="studio-pane-label">Customize this preview</p>
      <div className="customize-grid">
        <label htmlFor="studio-theme">
          Theme
          <select id="studio-theme" value={themeId} onChange={(e) => onTheme(e.target.value)} disabled={busy}>
            {THEMES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="studio-look">
          Color
          <select id="studio-look" value={look} onChange={(e) => onLook(e.target.value)} disabled={busy}>
            <option value="default">Teal</option>
            <option value="vivid">Vivid</option>
          </select>
        </label>
        <label htmlFor="studio-motion">
          Motion
          <select id="studio-motion" value={motion} onChange={(e) => onMotion(e.target.value)} disabled={busy}>
            {MOTIONS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor="studio-source" className="customize-source">
          Data URL
          <input
            id="studio-source"
            value={sourceUrl}
            onChange={(e) => onSourceUrl(e.target.value)}
            placeholder="Paste an API URL to rebind live JSON"
            disabled={busy}
            spellCheck={false}
          />
        </label>
      </div>
      <div className="customize-actions">
        <Button type="submit" size="sm" disabled={busy}>
          Apply
        </Button>
        <p className="muted">
          {published
            ? 'Saves a new live version. Pin ?v= if an embed should stay frozen.'
            : 'Updates this chat. Publish when you want an embed URL for another dashboard.'}
        </p>
      </div>
    </form>
  )
}
