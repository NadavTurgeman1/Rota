---
name: design-system-setup
description: >-
  Creates DESIGN.md plus CSS/Tailwind design tokens for color, type, spacing,
  radius, shadow, and motion, then refactors hard-coded values. Use when setting up
  a design system, tokens, typography, or color foundation before a redesign.
---
# Design system setup

## Steps
1. Confirm brand tone and whether light and dark modes are needed.
2. Generate tokens with this prompt:

```
Create a DESIGN.md + CSS variables (and Tailwind theme mapping) for [brand, tone].
Include: color tokens (bg, surface, surface-2, text, text-muted, border, accent, accent-contrast, success/warn/error) for light [and dark]; contrast ratio for every text/background pair (AA: 4.5:1 text, 3:1 UI/icons) — fix failing pairs with the smallest change that keeps hue.
Type: display + body font pairing (not Inter/Roboto), modular scale (e.g. 1.25) with sizes 12–72px, line-heights, letter-spacing, max line length 60–75ch, tabular numbers for prices/data.
Spacing scale 4/8/12/16/24/32/48/64/96; radius scale; shadow/elevation scale; motion tokens (durations 120/180/300/600ms, 3 easings).
Then refactor [files] to use only these tokens — no hard-coded values.
```

3. Write `DESIGN.md` and wire CSS variables / Tailwind theme.
4. Refactor targeted files to tokens only; leave behavior unchanged.
5. Verify contrast with a checker; use at most two font families.
