---
name: design-audit
description: >-
  Runs a scored website or UI design audit with AI-slop detection and a ranked fix
  list. Use when the user asks to critique, review, score, or audit site design,
  or when a working site looks weak and they need prioritized design fixes.
---
# Design audit

## Steps
1. Collect target: URL and/or screenshots at ~360, 768, and 1440 widths. Note stack if known.
2. Act as a senior product designer and run this prompt (fill the target):

```
Act as a senior product designer. Audit [URL/screenshots] and score 0–8 in each category: visual hierarchy, typography, color & contrast, spacing & rhythm, interaction states, responsive, motion, imagery/graphics, consistency, brand distinctiveness. Also give an "AI-slop score" 0–10 (generic fonts, purple gradients, identical card grids, emoji icons, vague copy).
Checks include: one unmistakable primary CTA per screen, ≤3 focal points, consistent heading scale, body ≥16px / line-height ≥1.4 / 50–80ch, spacing on a 4/8 scale, all buttons have hover/focus/active/disabled/loading.
Output: letter grade, top 10 fixes ranked by impact ÷ effort, each with the exact change (CSS/token/component), then a 3-step implementation plan.
```

3. Save findings to a short audit note in the project (e.g. `DESIGN-AUDIT.md`) unless the user wants chat-only.
4. Propose starting with the highest impact÷effort items; do not change code until the user picks a fix set.
5. Re-run the audit after a round of fixes to measure progress.
