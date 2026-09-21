import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function PublishDialog({ open, onOpenChange, snippet, embedUrl, onCopy, copied }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share this UI</DialogTitle>
          <DialogDescription>Copy the embed. GitHub is optional if you want owner edits later.</DialogDescription>
        </DialogHeader>
        {embedUrl ? (
          <iframe
            title="Published preview"
            className="h-56 w-full rounded-md border border-border bg-background"
            src={embedUrl}
          />
        ) : null}
        {embedUrl ? <code className="block overflow-x-auto rounded-md border border-border bg-muted px-3 py-2 text-sm">{embedUrl}</code> : null}
        {snippet ? (
          <pre className="max-h-32 overflow-auto rounded-md border border-border bg-muted p-3 text-xs">{snippet}</pre>
        ) : null}
        <DialogFooter>
          <Button type="button" onClick={onCopy}>
            <Copy />
            {copied ? 'Copied' : 'Copy iframe'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
