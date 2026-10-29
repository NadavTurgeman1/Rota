---
name: button-controls-system
description: >-
  Builds a reusable button and control system with full states, sizes, motion, and
  a demo page. Use when buttons are inconsistent, missing hover/focus/loading states,
  or the user wants a shared button, input, toggle, tab, or card control system.
---
# Button and controls system

## Steps
1. Locate existing component path, stack, and CSS variables.
2. Implement with:

```
Create a button system as a reusable component in [path] using [stack] and existing CSS variables.
Variants: primary, secondary, ghost, destructive, icon-only. Sizes: sm 32px, md 40px, lg 48px height (min touch target 44px on mobile).
States for every variant: default, hover, focus-visible (2px offset ring, 3:1 contrast), active/pressed, disabled (explain why via aria/tooltip), loading (spinner, keep width, aria-busy).
Interaction: hover lift translateY(-1px) + scale 1.02 + softer larger shadow, 180ms ease-out in, 240ms ease-in out; press scale 0.98, 100ms.
Radius [8px], padding x [16/20/24px], font weight 600, icon gap 8px.
Respect prefers-reduced-motion (no transform, color change only).
Output: the component, a demo page showing all variants × sizes × states, and a contrast table for each variant.
```

3. Ship a demo page that shows every variant × size × state.
4. Extend the same pattern to inputs, toggles, tabs, and cards when asked.
5. Prefer asymmetric hover timing (fast in, slower out).
