# Manual QA — MCP UI studio

Run against http://localhost:3000 with Redis + Mongo local (`store: redis-local · mongo: local`) and a TypeSafe key in Settings. Pin an API chip, then send the prompt. Expect the **Preview planner chip** and chat metrics to match the **Pass** column.

## Health and chrome

| # | Setup | Action | Pass |
|---|---|---|---|
| H1 | Fresh load | Open `/` | Chat + preview, IBM Plex, teal Send. No separate API URL field. Health: Jev connected or paste-key, `store: redis-local`, `mongo: local`. **Examples** tab lists recipes; **History** lists prior chats. |
| H2 | No Redis | Stop redis, reload | Health shows `store: redis-error` or `memory-disabled`. Generate still returns a widget (no 500). Replay/ratings may be off. |
| H5 | After a widget | **New chat**, then a new dashboard prompt | Planner is **Jev** (or Catalog/LLM), **not Iterate**, **not Replay**. Chat log cleared. |
| H3 | Settings, fields empty | Open Settings with no pasted keys | If `/api/health` has `jev.available: true`, status is **Connected from the server**, **not** “Add a TypeSafe key to generate.” Invalid pasted key still errors. Valid pasted key shows Connected. |
| H4 | Empty composer | Send with blank textarea | Send stays disabled. |
| H6 | No URL | `Create a dashboard for an ecommerce checkout app for shoes` | Title is a checkout (not "Data overview"). Stats are money totals (Subtotal/Total), cart table of shoes. Not a Note/Prompt dump. |
| H7 | New chat, no URL | `create a login page for Tata 1mg` | Centered **Sign in** card branded Tata 1mg (email + password). Planner **Catalog**, not LLM. Chat shows path `catalog → login-form` with thoughts. Not a Records table. |
| H8 | New chat, no URL | `create a polygon generator on google maps layer` | Map **workspace**: toolbar (select / polygon / delete), layers rail. Planner **Catalog**. **With** a Maps key (Settings, `GOOGLE_MAPS_API_KEY`, or paste on the canvas): Google Map + Drawing library, kicker **Google Maps SDK**. **Without** a key: gate **Load Google Maps SDK**, not a fake land SVG, not Primary/Details/Next. |
| H8b | New chat, no URL | `can you create me a dashboard using google maps and shadcn where user can create polygons on google map` | Same map workspace as H8. Planner **Catalog**, not Jev records / Primary/Details/Next. **Not Replay.** |
| H8c | After H8 without a Maps key | Paste a Maps browser key on the canvas and **Load Google Maps SDK**, or Settings → Save → **Replan** | Preview loads `maps.googleapis.com` (Drawing library). Polygon tool draws on the Google Map. Not a teal land SVG. |
| H8d | New chat | Same Google Maps polygon prompt as H8b | Same map workspace as H8. Planner **Catalog** / **Jev**, **not Replay**, not Primary/Details/Next. Asking again is a live plan. |
| H8e | After H8 | `you haven't use google maps sdk` | Planner **Catalog** or **Iterate**, not a 50s LLM clone of the same canvas, **not Replay**. Gate or Google Map still visible. |
| H9 | After a long chat with a widget | Scroll the left chat log, then the right preview | Each pane scrolls on its own. The page does not grow; composer and preview toolbar stay put. |
| H10 | History tab, two chats | Trash → **Remove** on one chat | Chat leaves History. Status: kept for training. Reopen History: gone. Mongo `studio_chats` (or local archive if Mongo is off). |
| H11 | Weather pin, **New chat** between sends (or same prompt twice in a new session) | Send W1 twice with `fresh: true` (Studio always does) | Both planners are **Jev**, **not Replay**. Preview meta **live**, not **cached**. **Turns** rail still shows `v1` / `v2`. Thumbs-up does **not** unlock fingerprint replay — Studio does not replay Redis fingerprints. |

## First-turn layouts (Weather chip)

Pin **Weather**. Each row is a **new browser tab** (or clear session) so it is not an iterate.

| # | Prompt | Pass |
|---|---|---|
| W1 | `Create a dashboard from this API` | Stats + line chart + table. Summary `Live data · api.open-meteo.com`. Planner **Jev** (live plan). Asking again is still **Jev**, **not Replay**. No raw JSON dump. Times formatted (`Sep 18, 12 AM`). |
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

## Live plan vs iterate (fingerprint replay is off)

Studio does **not** replay Redis fingerprints. `CONTEXT.md`: every turn plans live. Asking the same create prompt again must be a live **Jev** / **LLM** / **Catalog** plan, never a **Replay** chip.

| # | Action | Pass |
|---|---|---|
| R1 | Repeat the **exact** W1 prompt in a **new** session after W1 succeeded | Live plan. Planner **Jev** (or Catalog/Heuristic if no TypeSafe key). **Not Replay.** Preview meta **live**, not cached. Latency is a real plan, not a fingerprint hit. |
| R2 | Different prompt, same Weather URL (`add tooltip…`) with an existing session widget | **Iterate**, not Replay. |
| R3 | Different prompt, same Weather URL, **new** session (no prior widget) | Jev/heuristic new layout — not a neighbor’s dashboard with the old title/summary stolen. **Not Replay.** |
| R4 | After any widget, click **Replan** in the preview toolbar (if present) | Planner is **not Replay**. Preview meta shows **live**. Same bound API; layout may change. |
| R5 | Send the same W1 prompt twice in one new session with Studio’s default `fresh: true` | Both turns **Jev**, **not Replay**. There is no Skip-layout-cache control. Follow-ups still Iterate. |

## Publish, ratings, embed

| # | Action | Pass |
|---|---|---|
| E1 | Generate W1, **Publish** without GitHub | Unlisted `/e/:id` link, iframe snippet. No 401 wall. |
| E2 | Open embed URL | Same dashboard, tooltips work inside the iframe. Unpinned URL is live version. |
| E3 | Thumbs up/down | Succeeds when store is redis/redis-local. |
| E4 | GitHub owner (if OAuth configured) | `/w/:id` customize; anonymous cannot PATCH an owned widget. |
| E5 | Iterate twice, click **v1** in Turns | Preview returns to first widget; next follow-up iterates that layout. |
| E6 | **Customize** → Color Vivid → Apply | Preview `data-look="vivid"`; a new version chip appears. |
| E7 | After Publish, **Pin vN** | Clipboard has `/e/:id?v=N`. Opening it stays on that version if live later changes. |

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

## P0 Agent memory / dynamic generate

Do these on http://localhost:3000 with API on :3001. **New chat** before (a), (c), and (d). TypeSafe + Anthropic keys from `.env.local` (leave Settings fields **empty**). Planner chip must never say **Replay**.

| # | Setup | Action | Pass |
|---|---|---|---|
| P0a | New chat, empty composer, no URL chip | `create checkout for clothing brand Snitch, graffiti animation on load` | Planner **LLM** / generate (`haiku:generate`), **not Catalog checkout**, **not Replay**. Canvas is a generated **html-block** Snitch/clothing checkout with load motion (`data-motion` not `none`). **Not** Stride shoes / Aero Runner catalog cart. Chat thoughts mention generate / out of catalog. |
| P0b | Same session as P0a (do **not** New chat) | `graffiti is not visible` | Still a **Snitch checkout** (cart / pay / clothing). **Not** a graffiti message wall. Planner may be LLM generate or Iterate. Original ask is remembered in thoughts (`Remembering the original ask`). |
| P0c | New chat | `Create a game of tic tac toe with heavy animation` | Generated / **html-block** game with motion. **Not** a workspace board (`work-stage`, “Workspace generated”, notes canvas). Planner **not Replay**. |
| P0d | New chat, then **New chat** again | Send the P0a create prompt, then send the **same** create prompt in a second new session | Both live plans. Planner **not Replay**. Second canvas is still Snitch generate, **not** a cached Stride cart. |
| P0e | Settings fields empty; `.env.local` has `TYPESAFE_API_KEY` (and optionally `ANTHROPIC_API_KEY`) | Open `/`, then Settings → Keys | Health `jev.available: true`. Canvas does **not** show **Add a TypeSafe key to generate**. Settings TypeSafe status is **Connected from the server (.env.local)** (or Connected), **never** “Add a TypeSafe key to generate.” Paste-key field may stay blank. Composer Send is enabled. |

API-only (if the UI is down): `POST http://localhost:3001/api/chat/turn` with `{ "message", "sessionId", "fresh": true, "history"? }`. Assert `meta.planner !== "replay"`, `meta.cached !== true`, and `spec.components[].type`.

## Product gaps to re-check after changes

If any row fails, prefer a **code** upgrade (iterate / ThemeAdapter) over sending the prompt to Haiku.

- Follow-ups must not paint “Heuristic view of …” on a Jev/Iterate widget.
- Neighbor policies must not skip instruction upgrades.
- Chart tooltips are on by default for line/bar; “add tooltip” is still a visible Iterate turn.
