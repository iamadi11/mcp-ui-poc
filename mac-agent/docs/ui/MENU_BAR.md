# Mac Agent — Menu bar UI

Source: ui-ux-pro-max (AI-native pattern + productivity teal palette).  
**Rejected** default purple AI chrome; use teal `#0D9488`.

## Hierarchy

1. Brand + phase badge (Ready / Listening / Working / OK / Error)
2. Status card — Heard / Result / meta (loading spinner while busy)
3. Primary CTA — **Listen 3 seconds**
4. **Act once** — off by default; arms the next action to run live, then turns off
5. Secondary — Battery · Ollama · AX journey
6. Permissions (disclosure) — not competing with primary job
7. Quit

## UX rules applied

- Success / error feedback after every action (not silent)
- Loading state during Listen / Ollama (no frozen panel)
- SF Symbols only (no emoji icons)
- `.accessibilityLabel` / hints on primary controls
- Primary action visually dominant (`borderedProminent` + teal)

## Stack note

SwiftUI `MenuBarExtra` + `.menuBarExtraStyle(.window)` — no verified “menu bar panel” rows in ui-ux-pro-max SwiftUI CSV; used general SwiftUI a11y + status-feedback guidance.
