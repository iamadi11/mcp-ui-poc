# Manual QA — MCP UI studio

Run against http://localhost:3000 with Redis + Mongo local (`store: redis-local · mongo: local`) and a TypeSafe key in Settings. Pin an API chip, then send the prompt. Expect the **Preview planner chip** and chat metrics to match the **Pass** column.

## Health and chrome

| # | Setup | Action | Pass |
|---|---|---|---|
| H1 | Fresh load | Open `/` | Chat + preview, IBM Plex, teal Send. Health: Jev connected or paste-key, `store: redis-local`, `mongo: local`. **Examples** tab lists pasted APIs; Send on a card generates into Chat. |
| H2 | No Redis | Stop redis, reload | Health shows `store: redis-error` or `memory-disabled`. Generate still returns a widget (no 500). Replay/ratings may be off. |
| H5 | After a widget | **New chat**, then a new dashboard prompt | Planner is Jev/Replay, not Iterate. Chat log cleared; URL field may stay. |
| H3 | Settings | Paste invalid TypeSafe key, verify | Error, not a hang. Valid key shows connected. |
| H4 | Empty composer | Send with blank textarea | Send stays disabled. |
| H6 | No URL | `Create a dashboard for an ecommerce checkout app for shoes` | Title is a checkout (not "Data overview"). Stats are money totals (Subtotal/Total), cart table of shoes. Not a Note/Prompt dump. |

## First-turn layouts (Weather chip)

Pin **Weather**. Each row is a **new browser tab** (or clear session) so it is not an iterate.

| # | Prompt | Pass |
|---|---|---|
| W1 | `Create a dashboard from this API` | Stats + line chart + table. Summary `Live data · api.open-meteo.com`. Planner **Jev** (or Replay on exact retry). No raw JSON dump. Times formatted (`Sep 18, 12 AM`). |
| W2 | `Create a dashboard from this API with heavy animations` | Same widgets, `data-motion="stagger"` (sections stagger in). Not a Heuristic subtitle. |
| W3 | `Show as a table` | Table of hourly rows; no requirement for a chart. |
| W4 | `Show as a bar chart` | Chart present; bar or line (time series may stay line). Values are temperatures, not empty. |
| W5 | `Single embeddable component` | `presentation: component` — no page `<h1>` chrome in the iframe. |

## Iterate (same session — the bug this suite guards)

Do **W1 or W2 first**, then the follow-ups **without** starting a new session.

| # | Follow-up | Pass |
|---|---|---|
| I1 | `add tooltip on temperature graph` | Planner **Iterate** (not Jev 3%, not Replay of the previous dashboard). Chart still the same series. Hover a point: floating `chart-tooltip` with time + value. Layout does not reset to Heuristic copy. |
| I2 | `make it a bar chart` | Same fields; chart type bar (unless still a dense time series rendered as line — values still hoverable). |
| I3 | `hide the table` | Table gone; stats + chart remain. |
| I4 | `add tooltip on the chart` via the **Add tooltip** chip | Same as I1. |
| I5 | Third prompt in a row after I1 | Still Iterate; does not silently restore the table if I3 hid it. |
| I6 | `Add animations on the dashboard.` | Planner **Iterate**. Preview iframe `data-motion="stagger"`; sections/rows ease in (unless OS reduced-motion). |
| I7 | `add tooltip and drawer for more insights.` or `make the UI responsive` | Planner **Iterate**. Insights panel on the right; tap a table row to load nested fields. Narrow width stacks to cards + bottom sheet. |

## Other APIs

| # | Chip | Prompt | Pass |
|---|---|---|---|
| U1 | Users | `Create a dashboard from this API` | Names/emails in a table, not nested JSON blobs. Headers like Name / Email, not `address` objects. |
| U2 | Users | then `hide the table` | Table removed. |
| P1 | Posts | `Create a dashboard from this API` | Title/body columns; chart only if a numeric field exists. |
| P2 | Posts | `Show as a table` | Readable posts table. |
| C1 | Paste `https://jsonplaceholder.typicode.com/comments` in the URL field | `Create a dashboard from this API` | Name / Email / Body columns; Dashboard chip sends immediately. |

## Replay vs iterate

| # | Action | Pass |
|---|---|---|
| R1 | Repeat the **exact** W1 prompt in a **new** session after W1 succeeded | Plan ~tens of ms, planner **Replay**. |
| R2 | Different prompt, same Weather URL (`add tooltip…`) with an existing session widget | **Iterate**, not Replay. |
| R3 | Different prompt, same Weather URL, **new** session (no prior widget) | Jev/heuristic new layout — not a neighbor’s dashboard with the old title/summary stolen. |

## Publish, ratings, embed

| # | Action | Pass |
|---|---|---|
| E1 | Generate W1, **Publish** without GitHub | Unlisted `/e/:id` link, iframe snippet. No 401 wall. |
| E2 | Open embed URL | Same dashboard, tooltips work inside the iframe. |
| E3 | Thumbs up/down | Succeeds when store is redis/redis-local. |
| E4 | GitHub owner (if OAuth configured) | `/w/:id` customize; anonymous cannot PATCH. |

## Errors and edges

| # | Action | Pass |
|---|---|---|
| X1 | Prompt with no URL and no chip | Honest empty/note UI, not a crash. |
| X2 | `https://example.invalid/nope` | Fetch error surfaced in chat, preview not a blank iframe forever. |
| X3 | Follow-up with chip **deselected** after W1 | Iterate still hydrates Weather from the session URL. |
| X4 | Rapid double-send | Composer disabled while busy; **one** user bubble, not two overlapping planners. |
| X5 | Very long prompt | Truncated to planner excerpt; no secrets in HTML. |

## Visual / a11y

| # | Check | Pass |
|---|---|---|
| V1 | Chart hover | Tooltip follows pointer; native `<title>` fallback. |
| V2 | Dark/light | Stats, chart teal `#0F766E`, table rows readable. |
| V3 | Reduced motion | Stagger/live animations off when OS prefers reduced motion. |
| V4 | Mobile width (~390px) | Chat stacks, chart not clipped into JSON. |

## Product gaps to re-check after changes

If any row fails, prefer a **code** upgrade (iterate / ThemeAdapter) over sending the prompt to Haiku.

- Follow-ups must not paint “Heuristic view of …” on a Jev/Iterate widget.
- Neighbor policies must not skip instruction upgrades.
- Chart tooltips are on by default for line/bar; “add tooltip” is still a visible Iterate turn.
