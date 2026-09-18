# MCP UI studio — design system

Agents: read this before any `client/` visual work. Generated iframe HTML still uses ThemeAdapter CSS; this file governs **host chrome**.

## Product

B2B developer studio: chat-first widget generator with a live embed preview. Tool-like, not a marketing splash.

## Anti-slop (mandatory)

- No Inter as the UI font.
- No purple/violet full-page gradients or mesh orbs.
- No decorative `backdrop-filter` on the shell. Blur only for modal/sheet overlays.
- No emoji as icons — Lucide (or equivalent SVG) only.
- Semantic tokens only (no raw hex in components).
- One accent, used on Send / Publish / success — not rainbow CTAs.

## Type

- UI: **IBM Plex Sans**
- Code / IDs / URLs: **JetBrains Mono**
- Body ≥ 16px in chat; tabular figures in meta chips
- Line-height 1.5–1.75

## Color

Light: paper background `#F8F9FB`, ink `#0F172A`, hairline borders, cards `#FFFFFF`.
Dark: `#0F172A` background, `#1B2336` cards, `#E2E8F0` text.
Accent: `#0F766E` (teal) light / `#2DD4BF` dark. Danger `#DC2626`. Success `#16A34A`.

Dark is a desaturated sibling of light, not an invert.

## Density and motion

- App density 7–8 (8–32px scale). Marketing/docs only if added later: 4–5.
- Motion 3–4: 150–250ms opacity/transform, button scale 0.97–1. Streaming cursor in chat. Skeletons if wait > 1s.
- `prefers-reduced-motion`: jump to the final preview; no stagger.

## Layout

- Split: chat rail (primary) + preview (secondary) on ≥1024px; stack on small screens.
- Breakpoints: 375 / 768 / 1024 / 1440. No horizontal page scroll.
- Touch targets ≥ 44px in the composer.

## Checklist before merge

Contrast 4.5:1, visible focus rings, keyboard order, reduced-motion, no emoji icons, reserved space for preview (no CLS).
