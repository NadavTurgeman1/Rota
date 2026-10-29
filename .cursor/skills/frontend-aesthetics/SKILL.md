---
name: frontend-aesthetics
description: >-
  Applies a persistent anti-AI-slop frontend aesthetic brief for websites and UI.
  Use when starting design work, setting project design rules, or whenever generating
  or redesigning pages, components, landing pages, or visual UI so outputs stay
  distinctive instead of generic.
---
# Frontend aesthetics (base rules)

Paste and follow these rules for every design or frontend generation task in this project. Prefer writing them into project rules (`DESIGN.md`, Cursor rules) once, then enforce them.

## Steps
1. Before coding, commit to **ONE** bold aesthetic direction that fits the brand, audience, and purpose (e.g. editorial, luxury/refined, brutalist, soft/organic, retro-futuristic). State it in one sentence plus the one memorable thing about this design.
2. Apply this brief:

```
<frontend_aesthetics>
Avoid generic "AI slop". Commit to ONE bold aesthetic that fits: [BRAND / AUDIENCE / PURPOSE].
Typography: distinctive display + refined body (Google Fonts). Never Inter, Roboto, Arial, system fonts, or Space Grotesk.
Color: CSS variables; one dominant + one sharp accent; no purple-on-white gradients.
Layout: intentional composition, asymmetry, generous negative space.
Backgrounds: atmosphere and depth (layered gradients, subtle noise/grain, geometric patterns), not flat fills.
Motion: one orchestrated page-load with staggered reveals beats scattered effects. CSS-first; Motion for React if available.
Always: responsive (360px → 1440px), WCAG AA contrast, visible focus states, prefers-reduced-motion.
</frontend_aesthetics>
```

3. Fill brand and audience concretely. Offer 2–3 visual directions first when the direction is unclear, then lock one.
4. Do not forbid fonts loosely — name the common alternatives you refuse so the model does not hop to the next generic font.
5. Keep tokens and these rules in `DESIGN.md` / project rules so later prompts stay consistent.
