import { MessageSquarePlus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { widgetKindLabel } from './starters.js'

function relativeTime(value) {
  const then = Date.parse(value || '')
  if (!Number.isFinite(then)) return ''
  const delta = Math.max(0, Date.now() - then)
  const mins = Math.round(delta / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.round(hours / 24)
  return `${days}d`
}

export function RecentsSidebar({
  open,
  chats,
  activeId,
  busy,
  onOpen,
  onNew,
  onRemove,
  onClose,
}) {
  if (!open) return null
  return (
    <div className="studio-recents-overlay">
      <button
        type="button"
        className="studio-recents-scrim"
        aria-label="Close recents"
        onClick={onClose}
      />
      <aside className="studio-recents-panel" aria-label="Recents" role="dialog" aria-modal="true">
        <div className="studio-recents-head">
          <p className="text-sm font-medium">Recents</p>
          <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={onNew} disabled={busy}>
            <MessageSquarePlus />
            New
          </Button>
        </div>
        <div className="studio-recents-list">
          {chats.length === 0 ? (
            <p className="px-2 text-sm text-muted-foreground">No chats yet.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {chats.map((chat) => (
                <li key={chat.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    className={`min-h-11 min-w-0 flex-1 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted ${chat.id === activeId ? 'bg-muted' : ''}`}
                    onClick={() => {
                      onOpen(chat)
                      onClose?.()
                    }}
                  >
                    <span className="block truncate">{chat.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {[widgetKindLabel(chat.result), relativeTime(chat.updatedAt)].filter(Boolean).join(' · ')}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="min-h-11 min-w-11 rounded-md p-1 text-muted-foreground hover:bg-muted"
                    aria-label={`Remove ${chat.title || 'chat'}`}
                    disabled={busy}
                    onClick={() => onRemove(chat)}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>
  )
}
