---
name: accessibility-responsive-pass
description: >-
  Audits and fixes WCAG 2.2 AA and responsive issues (contrast, focus, targets,
  reflow, landmarks). Use when the user asks for accessibility, a11y, responsive
  QA, keyboard navigation, or a final polish pass before ship.
---
# Accessibility and responsive pass

## Steps
1. Target the page/HTML/URL to audit.
2. Run:

```
Audit [page/HTML/URL] against WCAG 2.2 AA and responsive best practice. Check: contrast (4.5:1 text, 3:1 UI), focus-visible and order, labels/semantics/landmarks, target size ≥ 24px (aim 44px), color-not-only cue, forms/errors, motion/autoplay, reflow at 320px and 200% zoom, no horizontal scroll at 360/768/1024/1440.
For each issue: criterion, element (quote it), why it fails, who it affects, fix as corrected code. Group by severity (blocks task / makes hard / minor). Mark what needs a manual check. Then apply the fixes.
```

3. Apply fixes grouped by severity.
4. Manually verify with Tab order, phone width, and 200% zoom. Automated scores alone are not enough.
5. Optionally run Lighthouse after the manual pass; do not treat 100 as proof of no issues.
