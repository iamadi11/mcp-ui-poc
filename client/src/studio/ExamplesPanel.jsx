import { useMemo, useState } from 'react'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EXAMPLE_KINDS, EXAMPLES } from './examples.js'

export function ExamplesPanel({ onSend, busy }) {
  const [kind, setKind] = useState('')
  const kinds = useMemo(() => {
    const used = new Set(EXAMPLES.map((item) => item.kind))
    return EXAMPLE_KINDS.filter((item) => used.has(item.id))
  }, [])
  const visible = kind ? EXAMPLES.filter((item) => item.kind === kind) : EXAMPLES

  return (
    <div className="examples-panel">
      <p className="examples-lead">
        Public JSON endpoints, already pasted. Send starts a new chat and generates the widget.
      </p>
      <div className="studio-chips" role="list">
        <button
          type="button"
          className={`chip ${kind === '' ? 'chip-on' : ''}`}
          onClick={() => setKind('')}
        >
          All
        </button>
        {kinds.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`chip ${kind === item.id ? 'chip-on' : ''}`}
            onClick={() => setKind(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <ul className="example-list">
        {visible.map((item) => {
          const kindLabel = EXAMPLE_KINDS.find((entry) => entry.id === item.kind)?.label || item.kind
          return (
            <li key={item.id} className="example-card">
              <div className="example-card-head">
                <h2 className="example-title">{item.title}</h2>
                <span className="example-kind">{kindLabel}</span>
              </div>
              <p className="example-blurb">{item.blurb}</p>
              {item.url ? (
                <pre className="example-paste" tabIndex={0}>
                  {item.url}
                </pre>
              ) : (
                <p className="example-paste">No API — in-studio demo cart</p>
              )}
              <p className="example-prompt">{item.prompt}</p>
              <Button
                type="button"
                size="sm"
                className="example-send"
                disabled={busy}
                onClick={() => onSend(item)}
              >
                <Send size={14} />
                Send
              </Button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
