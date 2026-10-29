---
name: animation-polish
description: >-
  Implements purposeful page-load, scroll-reveal, and hover motion with exact
  durations, easing, stagger, and reduced-motion support. Use when adding or
  polishing animations, micro-interactions, GSAP/Motion/CSS motion, or when motion
  feels random or missing.
---
# Animation polish pass

## Steps
1. Prefer a project motion rules file (e.g. `.cursor/rules/motion.md`) with springs (hover: stiffness 300, damping 20; tap: 400/15), stagger 60–80ms (cap 480ms), default easing `[0.16, 1, 0.3, 1]`.
2. For a specific animation:

```
Implement this animation in [path] using [CSS | Motion for React | GSAP].
Trigger: [on mount | hover on .card | when 30% of section is in view]
Sequence:
1. [element]: [property] [from] -> [to], [duration]ms, delay [x]ms, easing cubic-bezier(0.22,1,0.36,1)
2. [element]: ...
Stagger: [children] 60–80ms apart, total delay capped at 480ms.
Rules: animate transform and opacity only; use these exact values (don't round to 300ms or "ease"); put durations/easings in named constants; Motion/GSAP use seconds; respect prefers-reduced-motion.
Finish with a table: element, property, start ms, end ms, easing.
```

3. Default scroll-reveal (no library) when suitable:

```
Add scroll reveals: each main section starts opacity 0, translateY(20px), and transitions to visible over 600ms ease-out when it enters the viewport via one IntersectionObserver adding an .in-view class. Grids stagger children by 80ms (cap 480ms). No library. Disable under prefers-reduced-motion.
```

4. One orchestrated page-load sequence beats scattered effects. Use GSAP only for complex scroll-driven sequences; CSS is enough for most sites.
5. End with the timing table and a reduced-motion check.
