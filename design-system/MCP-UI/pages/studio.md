# Studio journey

Overrides [`MASTER.md`](../MASTER.md) for **copy and IA only**. Colors, type, anti-slop, and density stay with Master.

## Job

Describe a UI. See it. Talk to change it. Share it.

The host is a **creation canvas**, not a planner debugger. Machine traces may still exist on the wire; the UI maps them to human stages.

## Stages

### Arrive (empty)

- One headline: **Describe a UI**
- One sub: **See it live. Talk to change it. Share an embed.**
- One composer (message may include a JSON URL).
- Four starters: Login, Dashboard, Landing, Checkout. They must produce those UIs.
- Quiet actions: Recents, Settings, **Use my colors**.
- Recents is an overlay with a scrim, not a layout column.
- Default empty canvas is **Describe a UI**. Local `.env.local` is connected after health loads — do not treat missing-key as the empty state.
- Never: Chat/History/Examples as equal tabs, Skip layout cache, Replan, “Lab:”, planner pills.

### Watch

Reserved preview (no layout jump). Status copy only:

1. Fetching data (live URL only)
2. Designing layout
3. Rendering

Skeleton if wait > 1s. `prefers-reduced-motion`: jump to the final preview. `aria-busy` on the canvas.

### See / Talk

Preview is primary on ≥1024px; chat is a thin log. Suggested follow-ups after first success (dismissible) match the widget: landing/checkout get vivid + rounder corners; dashboards get hide table / chart; login gets vivid + tighter card. Never a locked tour.

### Share

Publish on the canvas chrome. Dialog for the iframe snippet. GitHub is optional and never blocks the first preview.

### Look (optional)

Settings sheet: **Connect your look**. Starter packs, paste CSS variables, or upload tokens.json. Live sample of login + landing (no Jev). Local `.env.local` is connected — paste fields stay empty. “Add a TypeSafe key to generate” is the no-env BYOK case only (health loaded, neither env nor pasted keys).

## Empty / loading / error

| State | Copy | Action |
|-------|------|--------|
| Empty | Describe a UI | Composer + starters |
| Loading | Fetching data (live URL only) / Designing layout / Rendering | None (busy) |
| Connected (`.env.local`) | Describe a UI — no missing-key copy | Composer + starters |
| No env and no pasted keys (BYOK) | Add a TypeSafe key to generate | Open Settings |
| Failed generate (keys present) | Couldn’t build this UI + the Haiku/generate error | Try again |
| Maps without key | Paste a Maps key on the canvas | Inline in iframe |

## Buried (not the product)

Planner path, confidence %, Skip cache, Replan. Optional `?debug=1` may show traces.

## Deep links

`/?c=:chatId` restores a recent chat. Settings never lives on the first screen as a wall.
