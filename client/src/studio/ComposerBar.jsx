import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CREATE_STARTERS, iterateChipsFor } from './starters.js'

export function ComposerBar({
  draft,
  onDraft,
  onSend,
  busy,
  empty,
  result,
  chipsVisible,
  onDismissChips,
  onOpenLook,
}) {
  const chips = empty ? CREATE_STARTERS : iterateChipsFor(result)
  return (
    <form
      className="composer-bar"
      onSubmit={(e) => {
        e.preventDefault()
        onSend()
      }}
    >
      {chipsVisible ? (
        <div className="studio-chips" role="list">
          {chips.map((item) => (
            <button
              key={item.label}
              type="button"
              className="chip"
              disabled={busy}
              onClick={() => onSend(item.value)}
            >
              {item.label}
            </button>
          ))}
          {!empty ? (
            <button type="button" className="chip" onClick={onDismissChips}>
              Dismiss
            </button>
          ) : null}
        </div>
      ) : null}
      <label className="sr-only" htmlFor="studio-draft">Message</label>
      <textarea
        id="studio-draft"
        rows={3}
        value={draft}
        onChange={(e) => onDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            onSend()
          }
        }}
        placeholder="Describe a UI, or paste a JSON URL…"
        disabled={busy}
      />
      <div className="composer-bar-actions">
        <Button type="button" variant="ghost" size="sm" onClick={onOpenLook}>
          Use my colors
        </Button>
        <Button type="submit" className="composer-send" disabled={busy || !draft.trim()} aria-label="Send">
          <Send />
          Send
        </Button>
      </div>
    </form>
  )
}
